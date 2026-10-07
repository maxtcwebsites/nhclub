// Security-rules tests. Run with:  npm run test:rules
// (starts the Firestore emulator, runs this file, shuts it down).
//
// Most "allowed" cases call the real app code in src/lib/api.js, so the app
// and the rules are tested together. The "denied" cases try every trick a
// curious parent or a compromised account could try from the browser console.

import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import {
  clearAttendance,
  countResetData,
  createStudent,
  ensureUserProfile,
  recordCorrection,
  recordPayment,
  resetClubData,
  saveSettings,
  setAttendance,
  setStudentStatus,
  setUserRole,
  updateOwnProfile,
  updateStudentProfile,
} from '../src/lib/api.js';
import { periodEndFor } from '../src/lib/billing.js';
import { tr } from '../src/i18n/index.js';

const ADMIN = { uid: 'adminUid', email: 'r45t6er7@gmail.com', name: 'Club Owner', role: 'admin' };
const TEACHER = { uid: 'teacherUid', email: 'teacher@example.com', name: 'Ms Teacher', role: 'teacher' };
const PARENT = { uid: 'parentUid', email: 'parent@example.com', name: 'Pat Parent', role: 'parent' };
const OTHER = { uid: 'otherUid', email: 'other@example.com', name: 'Olly Other', role: 'parent' };

const CHILD = {
  firstName: 'Mia',
  lastName: 'Parent',
  dateOfBirth: '2018-04-12',
  grade: '2nd',
  allergies: 'Peanuts',
  medicalNotes: '',
  emergencyName: 'Grandma',
  emergencyPhone: '+1 555 0100',
  authorizedPickup: 'Grandma, Uncle Joe',
};

let env;

function ctx(person, { verified = true } = {}) {
  return env.authenticatedContext(person.uid, {
    email: person.email,
    email_verified: verified,
  }).firestore();
}

const adminDb = () => ctx(ADMIN);
const teacherDb = () => ctx(TEACHER);
const parentDb = () => ctx(PARENT);
const otherDb = () => ctx(OTHER);

async function seed(path, data) {
  await env.withSecurityRulesDisabled(async (c) => {
    await setDoc(doc(c.firestore(), path), data);
  });
}

async function read(path) {
  let data;
  await env.withSecurityRulesDisabled(async (c) => {
    const snap = await getDoc(doc(c.firestore(), path));
    data = snap.exists() ? snap.data() : null;
  });
  return data;
}

async function readAll(col) {
  let docs;
  await env.withSecurityRulesDisabled(async (c) => {
    const snap = await getDocs(collection(c.firestore(), col));
    docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  });
  return docs;
}

function userDoc(person, role) {
  return {
    uid: person.uid,
    email: person.email,
    displayName: person.name,
    phone: '',
    role,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

async function seedSettings(policy = 'charge') {
  await seed('settings/club', {
    clubName: 'Max TC',
    currency: '$',
    monthlyFeeCents: 5000,
    absencePolicy: policy,
    expiringSoonDays: 7,
    clubDays: [1, 2, 3, 4, 5],
    updatedBy: ADMIN.uid,
    updatedAt: new Date(),
    lastLogId: 'seedLog000000000001',
  });
}

async function newChild(db = parentDb(), actor = PARENT, data = CHILD) {
  return createStudent(db, actor, data);
}

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-nhclub',
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
  });
});

afterAll(async () => {
  await env?.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
  await seed(`users/${TEACHER.uid}`, userDoc(TEACHER, 'teacher'));
  await seed(`users/${PARENT.uid}`, userDoc(PARENT, 'parent'));
  await seed(`users/${OTHER.uid}`, userDoc(OTHER, 'parent'));
});

// ===========================================================================
describe('users', () => {
  it('lets a new user create their own parent profile (even before verifying)', async () => {
    const fresh = { uid: 'freshUid', email: 'fresh@example.com' };
    const db = ctx(fresh, { verified: false });
    await assertSucceeds(ensureUserProfile(db, fresh, { displayName: 'Fresh', phone: '123' }));
    expect((await read('users/freshUid')).role).toBe('parent');
  });

  it('blocks creating a profile with a teacher or admin role', async () => {
    const fresh = { uid: 'freshUid', email: 'fresh@example.com' };
    const db = ctx(fresh);
    for (const role of ['teacher', 'admin']) {
      await assertFails(
        setDoc(doc(db, 'users/freshUid'), {
          uid: 'freshUid',
          email: 'fresh@example.com',
          displayName: 'Fresh',
          phone: '',
          role,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }),
      );
    }
  });

  it('blocks creating a profile for someone else or with a fake email', async () => {
    const db = ctx({ uid: 'freshUid', email: 'fresh@example.com' });
    const base = {
      displayName: 'X',
      phone: '',
      role: 'parent',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    await assertFails(setDoc(doc(db, 'users/someoneElse'), { ...base, uid: 'someoneElse', email: 'fresh@example.com' }));
    await assertFails(setDoc(doc(db, 'users/freshUid'), { ...base, uid: 'freshUid', email: 'r45t6er7@gmail.com' }));
  });

  it('lets users edit their name/phone but never their role', async () => {
    await assertSucceeds(updateOwnProfile(parentDb(), PARENT, { displayName: 'Pat P.', phone: '555' }));
    await assertFails(updateDoc(doc(parentDb(), `users/${PARENT.uid}`), { role: 'teacher', updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(teacherDb(), `users/${TEACHER.uid}`), { role: 'parent', updatedAt: serverTimestamp() }));
  });

  it('only lets a user read their own profile; staff can read all', async () => {
    await assertSucceeds(getDoc(doc(parentDb(), `users/${PARENT.uid}`)));
    await assertFails(getDoc(doc(parentDb(), `users/${OTHER.uid}`)));
    await assertFails(getDocs(collection(parentDb(), 'users')));
    await assertSucceeds(getDocs(collection(teacherDb(), 'users')));
    await assertSucceeds(getDocs(collection(adminDb(), 'users')));
  });

  it('lets only the verified super admin promote/demote teachers, with a log', async () => {
    const target = { uid: PARENT.uid, email: PARENT.email, displayName: PARENT.name };
    await assertFails(setUserRole(teacherDb(), TEACHER, target, 'teacher'));
    await assertFails(setUserRole(parentDb(), PARENT, target, 'teacher'));
    // Same email, but not verified -> not the super admin.
    await assertFails(setUserRole(ctx(ADMIN, { verified: false }), ADMIN, target, 'teacher'));

    await assertSucceeds(setUserRole(adminDb(), ADMIN, target, 'teacher'));
    expect((await read(`users/${PARENT.uid}`)).role).toBe('teacher');
    const logs = await readAll('logs');
    expect(logs.some((l) => l.type === 'role_changed' && l.targetUid === PARENT.uid)).toBe(true);

    await assertSucceeds(setUserRole(adminDb(), ADMIN, target, 'parent'));
    expect((await read(`users/${PARENT.uid}`)).role).toBe('parent');
  });

  it('blocks a role change without the matching log entry', async () => {
    await assertFails(
      updateDoc(doc(adminDb(), `users/${PARENT.uid}`), {
        role: 'teacher',
        roleUpdatedBy: ADMIN.uid,
        roleUpdatedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        roleLogId: 'noSuchLog0000000001',
      }),
    );
  });

  it('never lets the super admin hand out an "admin" role', async () => {
    const target = { uid: PARENT.uid, email: PARENT.email, displayName: PARENT.name };
    await assertFails(setUserRole(adminDb(), ADMIN, target, 'admin'));
  });

  it('only the super admin can delete a profile, and never their own', async () => {
    await assertFails(deleteDoc(doc(parentDb(), `users/${PARENT.uid}`)));
    await assertFails(deleteDoc(doc(teacherDb(), `users/${PARENT.uid}`)));
    await seed(`users/${ADMIN.uid}`, userDoc(ADMIN, 'parent'));
    await assertFails(deleteDoc(doc(adminDb(), `users/${ADMIN.uid}`)));
  });

  it('a demoted teacher immediately loses staff access', async () => {
    await assertSucceeds(getDocs(collection(teacherDb(), 'students')));
    await setUserRole(adminDb(), ADMIN, { uid: TEACHER.uid, email: TEACHER.email, displayName: TEACHER.name }, 'parent');
    await assertFails(getDocs(collection(teacherDb(), 'students')));
  });
});

// ===========================================================================
describe('students', () => {
  it('lets a verified parent register a child', async () => {
    const id = await assertSucceeds(newChild());
    const student = await read(`students/${id}`);
    expect(student.parentUid).toBe(PARENT.uid);
    expect(student.paidUntil).toBe(null);
    const logs = await readAll('logs');
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({ type: 'student_created', studentId: id, actorRole: 'parent' });
  });

  it('blocks unverified accounts from registering children', async () => {
    await assertFails(newChild(ctx(PARENT, { verified: false })));
  });

  it('blocks a parent from registering a child as already paid', async () => {
    const db = parentDb();
    const batch = writeBatch(db);
    const sRef = doc(collection(db, 'students'));
    const lRef = doc(collection(db, 'logs'));
    batch.set(sRef, {
      ...CHILD,
      parentUid: PARENT.uid,
      status: 'active',
      paidUntil: '2030-01-01',
      totalPaidCents: 99999,
      monthsPaid: 12,
      creditDays: 0,
      lastPaymentAt: null,
      lastPaymentId: null,
      lastAttendanceId: null,
      lastLogId: lRef.id,
      createdBy: PARENT.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    batch.set(lRef, {
      type: 'student_created',
      studentId: sRef.id,
      targetUid: null,
      message: 'x',
      actorUid: PARENT.uid,
      actorName: PARENT.name,
      actorRole: 'parent',
      createdAt: serverTimestamp(),
    });
    await assertFails(batch.commit());
  });

  it('blocks registering a child under another parent', async () => {
    const db = parentDb();
    await assertFails(createStudent(db, { ...PARENT, uid: OTHER.uid }, CHILD));
  });

  it('lets staff enroll a child for an existing family account', async () => {
    const family = userDoc(PARENT, 'parent');
    const id = await assertSucceeds(createStudent(teacherDb(), TEACHER, CHILD, family));
    const student = await read(`students/${id}`);
    expect(student).toMatchObject({ parentUid: PARENT.uid, createdBy: TEACHER.uid, paidUntil: null, totalPaidCents: 0 });
    const logs = await readAll('logs');
    expect(logs[0]).toMatchObject({ type: 'student_created', studentId: id, actorRole: 'teacher' });
    expect(logs[0].message).toContain(PARENT.name);
    // The family sees the child in their account.
    const mine = await getDocs(query(collection(parentDb(), 'students'), where('parentUid', '==', PARENT.uid)));
    expect(mine.docs.map((d) => d.id)).toEqual([id]);

    await assertSucceeds(createStudent(adminDb(), ADMIN, CHILD, userDoc(OTHER, 'parent')));
  });

  it('blocks staff from enrolling for an account that does not exist', async () => {
    await assertFails(createStudent(teacherDb(), TEACHER, CHILD, { uid: 'ghostUid', displayName: 'Ghost' }));
  });

  it('blocks parents from enrolling a child into another family', async () => {
    await assertFails(createStudent(parentDb(), PARENT, CHILD, userDoc(OTHER, 'parent')));
  });

  it('blocks staff from enrolling a child as already paid', async () => {
    const db = teacherDb();
    const batch = writeBatch(db);
    const sRef = doc(collection(db, 'students'));
    const lRef = doc(collection(db, 'logs'));
    batch.set(sRef, {
      ...CHILD,
      parentUid: PARENT.uid,
      status: 'active',
      paidUntil: '2030-01-01',
      totalPaidCents: 5000,
      monthsPaid: 1,
      creditDays: 0,
      lastPaymentAt: null,
      lastPaymentId: null,
      lastAttendanceId: null,
      lastLogId: lRef.id,
      createdBy: TEACHER.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    batch.set(lRef, {
      type: 'student_created',
      studentId: sRef.id,
      targetUid: null,
      message: 'x',
      actorUid: TEACHER.uid,
      actorName: TEACHER.name,
      actorRole: 'teacher',
      createdAt: serverTimestamp(),
    });
    await assertFails(batch.commit());
  });

  it('blocks a student write without the audit log entry', async () => {
    const db = parentDb();
    const sRef = doc(collection(db, 'students'));
    await assertFails(
      setDoc(sRef, {
        ...CHILD,
        parentUid: PARENT.uid,
        status: 'active',
        paidUntil: null,
        totalPaidCents: 0,
        monthsPaid: 0,
        creditDays: 0,
        lastPaymentAt: null,
        lastPaymentId: null,
        lastAttendanceId: null,
        lastLogId: 'fakeLogId0000000001',
        createdBy: PARENT.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    );
  });

  it('rejects junk / oversized / extra fields', async () => {
    await assertFails(newChild(parentDb(), PARENT, { ...CHILD, dateOfBirth: 'yesterday' }));
    await assertFails(newChild(parentDb(), PARENT, { ...CHILD, firstName: '' }));
    await assertFails(newChild(parentDb(), PARENT, { ...CHILD, emergencyPhone: '' }));
    const id = await newChild();
    const db = parentDb();
    const batch = writeBatch(db);
    const lRef = doc(collection(db, 'logs'));
    batch.update(doc(db, `students/${id}`), { isVip: true, updatedAt: serverTimestamp(), lastLogId: lRef.id });
    batch.set(lRef, {
      type: 'student_updated',
      studentId: id,
      targetUid: null,
      message: 'x',
      actorUid: PARENT.uid,
      actorName: PARENT.name,
      actorRole: 'parent',
      createdAt: serverTimestamp(),
    });
    await assertFails(batch.commit());
  });

  it('parents only see their own children', async () => {
    const id = await newChild();
    await assertSucceeds(getDoc(doc(parentDb(), `students/${id}`)));
    await assertFails(getDoc(doc(otherDb(), `students/${id}`)));
    await assertSucceeds(getDocs(query(collection(parentDb(), 'students'), where('parentUid', '==', PARENT.uid))));
    await assertFails(getDocs(collection(parentDb(), 'students')));
    await assertFails(getDocs(query(collection(otherDb(), 'students'), where('parentUid', '==', PARENT.uid))));
    await assertSucceeds(getDocs(collection(teacherDb(), 'students')));
  });

  it('parents can edit the profile of their own child only', async () => {
    const id = await newChild();
    const student = { id, ...(await read(`students/${id}`)) };
    await assertSucceeds(updateStudentProfile(parentDb(), PARENT, student, { ...CHILD, allergies: 'None' }));
    expect((await read(`students/${id}`)).allergies).toBe('None');
    await assertFails(updateStudentProfile(otherDb(), OTHER, student, { ...CHILD, allergies: 'Hacked' }));
  });

  it('parents can never mark a child as paid or archive it', async () => {
    const id = await newChild();
    const db = parentDb();
    for (const change of [
      { paidUntil: '2030-01-01' },
      { totalPaidCents: 100000 },
      { creditDays: 1 },
      { status: 'archived' },
      { parentUid: OTHER.uid },
    ]) {
      const batch = writeBatch(db);
      const lRef = doc(collection(db, 'logs'));
      batch.update(doc(db, `students/${id}`), { ...change, updatedAt: serverTimestamp(), lastLogId: lRef.id });
      batch.set(lRef, {
        type: 'student_updated',
        studentId: id,
        targetUid: null,
        message: 'x',
        actorUid: PARENT.uid,
        actorName: PARENT.name,
        actorRole: 'parent',
        createdAt: serverTimestamp(),
      });
      await assertFails(batch.commit());
    }
    await assertFails(setStudentStatus(parentDb(), PARENT, { id, ...CHILD }, 'archived'));
  });

  it('staff can archive and re-activate students', async () => {
    const id = await newChild();
    await assertSucceeds(setStudentStatus(teacherDb(), TEACHER, { id, ...CHILD }, 'archived', 'moved away'));
    expect((await read(`students/${id}`)).status).toBe('archived');
    await assertSucceeds(setStudentStatus(adminDb(), ADMIN, { id, ...CHILD }, 'active'));
    await assertFails(setStudentStatus(teacherDb(), TEACHER, { id, ...CHILD }, 'deleted'));
  });

  it('parents and teachers cannot delete a student', async () => {
    const id = await newChild();
    await assertFails(deleteDoc(doc(parentDb(), `students/${id}`)));
    await assertFails(deleteDoc(doc(teacherDb(), `students/${id}`)));
  });

  it('a teacher cannot change paid-until directly without a ledger entry', async () => {
    const id = await newChild();
    const db = teacherDb();
    const batch = writeBatch(db);
    const lRef = doc(collection(db, 'logs'));
    batch.update(doc(db, `students/${id}`), {
      paidUntil: '2030-01-01',
      updatedAt: serverTimestamp(),
      lastLogId: lRef.id,
    });
    batch.set(lRef, {
      type: 'student_updated',
      studentId: id,
      targetUid: null,
      message: 'x',
      actorUid: TEACHER.uid,
      actorName: TEACHER.name,
      actorRole: 'teacher',
      createdAt: serverTimestamp(),
    });
    await assertFails(batch.commit());
  });
});

// ===========================================================================
describe('payments', () => {
  const pay = { amountCents: 10000, months: 2, method: 'cash', periodStart: '2026-10-01', note: '', currency: '$' };

  it('a teacher records a payment: ledger + student + log all move together', async () => {
    const id = await newChild();
    await assertSucceeds(recordPayment(teacherDb(), TEACHER, id, pay));
    const student = await read(`students/${id}`);
    expect(student).toMatchObject({ paidUntil: '2026-11-30', totalPaidCents: 10000, monthsPaid: 2, creditDays: 0 });
    const payments = await readAll('payments');
    expect(payments).toHaveLength(1);
    expect(payments[0]).toMatchObject({ studentId: id, parentUid: PARENT.uid, kind: 'payment', amountCents: 10000 });
    expect((await readAll('logs')).filter((l) => l.type === 'payment')).toHaveLength(1);

    await assertSucceeds(recordPayment(adminDb(), ADMIN, id, { ...pay, periodStart: '2026-12-01', months: 1, amountCents: 5000 }));
    expect(await read(`students/${id}`)).toMatchObject({ paidUntil: '2026-12-31', totalPaidCents: 15000, monthsPaid: 3 });
  });

  it('parents cannot record payments, even for their own child', async () => {
    const id = await newChild();
    await assertFails(recordPayment(parentDb(), PARENT, id, pay));
  });

  it('parents can read only their own payments', async () => {
    const id = await newChild();
    await recordPayment(teacherDb(), TEACHER, id, pay);
    await assertSucceeds(getDocs(query(collection(parentDb(), 'payments'), where('parentUid', '==', PARENT.uid))));
    await assertFails(getDocs(query(collection(otherDb(), 'payments'), where('parentUid', '==', PARENT.uid))));
    await assertFails(getDocs(collection(otherDb(), 'payments')));
  });

  it('rejects totals that do not add up', async () => {
    const id = await newChild();
    const db = teacherDb();
    const batch = writeBatch(db);
    const pRef = doc(collection(db, 'payments'));
    const lRef = doc(collection(db, 'logs'));
    batch.set(pRef, {
      studentId: id,
      parentUid: PARENT.uid,
      kind: 'payment',
      amountCents: 100,
      months: 1,
      method: 'cash',
      currency: '$',
      periodStart: '2026-10-01',
      periodEnd: '2027-10-01',
      previousPaidUntil: null,
      previousCreditDays: 0,
      note: '',
      createdBy: TEACHER.uid,
      createdByName: TEACHER.name,
      createdAt: serverTimestamp(),
    });
    batch.update(doc(db, `students/${id}`), {
      paidUntil: '2027-10-01',
      totalPaidCents: 999999, // lies about the total
      monthsPaid: 1,
      creditDays: 0,
      lastPaymentAt: serverTimestamp(),
      lastPaymentId: pRef.id,
      updatedAt: serverTimestamp(),
      lastLogId: lRef.id,
    });
    batch.set(lRef, {
      type: 'payment',
      studentId: id,
      targetUid: null,
      message: 'x',
      actorUid: TEACHER.uid,
      actorName: TEACHER.name,
      actorRole: 'teacher',
      createdAt: serverTimestamp(),
    });
    await assertFails(batch.commit());
  });

  it('rejects a payment entry that is not linked to the student update', async () => {
    const id = await newChild();
    const db = teacherDb();
    await assertFails(
      setDoc(doc(collection(db, 'payments')), {
        studentId: id,
        parentUid: PARENT.uid,
        kind: 'payment',
        amountCents: 100,
        months: 1,
        method: 'cash',
        currency: '$',
        periodStart: '2026-10-01',
        periodEnd: '2026-10-31',
        previousPaidUntil: null,
        previousCreditDays: 0,
        note: '',
        createdBy: TEACHER.uid,
        createdByName: TEACHER.name,
        createdAt: serverTimestamp(),
      }),
    );
  });

  it('rejects bad payment values', async () => {
    const id = await newChild();
    // The app refuses these before they ever reach the server...
    await expect(recordPayment(teacherDb(), TEACHER, id, { ...pay, amountCents: 0 })).rejects.toThrow(tr('pay.errAmount'));
    // ...and the rules refuse them too when the app is bypassed.
    for (const bad of [{ amountCents: 0 }, { amountCents: -500 }, { months: 0 }, { months: 99 }, { method: 'bitcoin' }]) {
      await assertFails(recordPaymentRaw(teacherDb(), TEACHER, id, { ...pay, ...bad }));
    }
  });

  it('a payment cannot cover more (or less) time than the months paid', async () => {
    const id = await newChild();
    // Sanity check: the raw helper itself is accepted with honest values...
    await assertSucceeds(recordPaymentRaw(teacherDb(), TEACHER, id, pay));
    // ...but not when 1 month is stretched over years or squeezed to a week.
    await assertFails(recordPaymentRaw(teacherDb(), TEACHER, id, { ...pay, months: 1, periodStart: '2027-01-01', periodEnd: '2036-01-01' }));
    await assertFails(recordPaymentRaw(teacherDb(), TEACHER, id, { ...pay, months: 1, periodStart: '2027-01-01', periodEnd: '2027-01-07' }));
    await assertFails(recordPaymentRaw(teacherDb(), TEACHER, id, { ...pay, months: 1, periodStart: '2027-01-01', periodEnd: '2026-12-01' }));
  });

  it('ledger entries can never be edited, and only the super admin can delete them', async () => {
    const id = await newChild();
    const paymentId = await recordPayment(teacherDb(), TEACHER, id, pay);
    await assertFails(updateDoc(doc(adminDb(), `payments/${paymentId}`), { amountCents: 1 }));
    await assertFails(deleteDoc(doc(teacherDb(), `payments/${paymentId}`)));
    await assertFails(deleteDoc(doc(parentDb(), `payments/${paymentId}`)));
  });

  it('corrections need a reason and move paid-until to the chosen date', async () => {
    const id = await newChild();
    await recordPayment(teacherDb(), TEACHER, id, pay);
    await assertSucceeds(
      recordCorrection(teacherDb(), TEACHER, id, {
        newPaidUntil: '2026-11-15',
        amountCents: -2500,
        months: 0,
        note: 'Refunded half a month',
        currency: '$',
      }),
    );
    expect(await read(`students/${id}`)).toMatchObject({ paidUntil: '2026-11-15', totalPaidCents: 7500, monthsPaid: 2 });
    await assertFails(recordCorrectionRaw(teacherDb(), TEACHER, id, { newPaidUntil: '2026-12-15', note: '' }));
  });

  it('a stale/concurrent write with wrong previous values is rejected', async () => {
    const id = await newChild();
    await recordPayment(teacherDb(), TEACHER, id, pay);
    // Pretend the client still thinks the student never paid.
    await assertFails(recordPaymentRaw(teacherDb(), TEACHER, id, pay, { paidUntil: null, totalPaidCents: 0, monthsPaid: 0, creditDays: 0 }));
  });
});

// A payment written by hand (no client validation) so we can feed the rules
// values the UI would never produce.
async function recordPaymentRaw(db, actor, studentId, p, assumed) {
  const current = assumed ?? (await read(`students/${studentId}`));
  const batch = writeBatch(db);
  const pRef = doc(collection(db, 'payments'));
  const lRef = doc(collection(db, 'logs'));
  const periodEnd = p.periodEnd ?? (p.months >= 1 && p.months <= 24 ? periodEndFor(p.periodStart, p.months) : '2026-12-31');
  batch.set(pRef, {
    studentId,
    parentUid: PARENT.uid,
    kind: 'payment',
    amountCents: p.amountCents,
    months: p.months,
    method: p.method,
    currency: '$',
    periodStart: p.periodStart,
    periodEnd,
    previousPaidUntil: current.paidUntil,
    previousCreditDays: current.creditDays,
    note: '',
    createdBy: actor.uid,
    createdByName: actor.name,
    createdAt: serverTimestamp(),
  });
  batch.update(doc(db, `students/${studentId}`), {
    paidUntil: periodEnd,
    totalPaidCents: current.totalPaidCents + p.amountCents,
    monthsPaid: current.monthsPaid + p.months,
    creditDays: 0,
    lastPaymentAt: serverTimestamp(),
    lastPaymentId: pRef.id,
    updatedAt: serverTimestamp(),
    lastLogId: lRef.id,
  });
  batch.set(lRef, {
    type: 'payment',
    studentId,
    targetUid: null,
    message: 'raw',
    actorUid: actor.uid,
    actorName: actor.name,
    actorRole: actor.role,
    createdAt: serverTimestamp(),
  });
  return batch.commit();
}

async function recordCorrectionRaw(db, actor, studentId, { newPaidUntil, note }) {
  const current = await read(`students/${studentId}`);
  const batch = writeBatch(db);
  const pRef = doc(collection(db, 'payments'));
  const lRef = doc(collection(db, 'logs'));
  batch.set(pRef, {
    studentId,
    parentUid: PARENT.uid,
    kind: 'correction',
    amountCents: 0,
    months: 0,
    method: 'adjustment',
    currency: '$',
    periodStart: null,
    periodEnd: newPaidUntil,
    previousPaidUntil: current.paidUntil,
    previousCreditDays: current.creditDays,
    note,
    createdBy: actor.uid,
    createdByName: actor.name,
    createdAt: serverTimestamp(),
  });
  batch.update(doc(db, `students/${studentId}`), {
    paidUntil: newPaidUntil,
    totalPaidCents: current.totalPaidCents,
    monthsPaid: current.monthsPaid,
    creditDays: 0,
    lastPaymentAt: serverTimestamp(),
    lastPaymentId: pRef.id,
    updatedAt: serverTimestamp(),
    lastLogId: lRef.id,
  });
  batch.set(lRef, {
    type: 'correction',
    studentId,
    targetUid: null,
    message: 'raw',
    actorUid: actor.uid,
    actorName: actor.name,
    actorRole: actor.role,
    createdAt: serverTimestamp(),
  });
  return batch.commit();
}

// ===========================================================================
describe('attendance', () => {
  const pay = { amountCents: 5000, months: 1, method: 'cash', periodStart: '2026-10-01', note: '', currency: '$' };

  it('teachers take attendance; parents can read their own child only', async () => {
    const id = await newChild();
    await assertSucceeds(setAttendance(teacherDb(), TEACHER, id, { date: '2026-10-05', status: 'present', note: 'On time', policy: 'charge' }));
    await assertSucceeds(
      getDocs(query(collection(parentDb(), 'attendance'), where('parentUid', '==', PARENT.uid))),
    );
    await assertFails(getDoc(doc(otherDb(), `attendance/${id}_2026-10-05`)));
    await assertFails(setAttendance(parentDb(), PARENT, id, { date: '2026-10-06', status: 'present', note: '', policy: 'charge' }));
  });

  it('with the default policy, absences do not extend the subscription', async () => {
    await seedSettings('charge');
    const id = await newChild();
    await recordPayment(teacherDb(), TEACHER, id, pay);
    await setAttendance(teacherDb(), TEACHER, id, { date: '2026-10-05', status: 'absent', note: '', policy: 'charge' });
    expect((await read(`students/${id}`)).creditDays).toBe(0);
    expect((await read(`attendance/${id}_2026-10-05`)).credited).toBe(false);
  });

  it('with the "all" policy, an absence adds a day and undoing it removes the day', async () => {
    await seedSettings('all');
    const id = await newChild();
    await recordPayment(teacherDb(), TEACHER, id, pay);
    await assertSucceeds(setAttendance(teacherDb(), TEACHER, id, { date: '2026-10-05', status: 'absent', note: 'sick', policy: 'all' }));
    expect((await read(`students/${id}`)).creditDays).toBe(1);
    await assertSucceeds(setAttendance(teacherDb(), TEACHER, id, { date: '2026-10-05', status: 'present', note: '', policy: 'all' }));
    expect((await read(`students/${id}`)).creditDays).toBe(0);
    await setAttendance(teacherDb(), TEACHER, id, { date: '2026-10-06', status: 'excused', note: '', policy: 'all' });
    expect((await read(`students/${id}`)).creditDays).toBe(1);
    await assertSucceeds(clearAttendance(teacherDb(), TEACHER, id, '2026-10-06'));
    expect((await read(`students/${id}`)).creditDays).toBe(0);
  });

  it('a teacher cannot grant absence credit the policy does not allow', async () => {
    await seedSettings('charge');
    const id = await newChild();
    await recordPayment(teacherDb(), TEACHER, id, pay);
    // Client claims the policy is "all" but the server setting says "charge".
    await assertFails(setAttendance(teacherDb(), TEACHER, id, { date: '2026-10-05', status: 'absent', note: '', policy: 'all' }));
  });

  it('the credit counter cannot be bumped without an attendance record', async () => {
    await seedSettings('all');
    const id = await newChild();
    await recordPayment(teacherDb(), TEACHER, id, pay);
    const db = teacherDb();
    const bump = async (creditDays, lastAttendanceId) => {
      const batch = writeBatch(db);
      const lRef = doc(collection(db, 'logs'));
      const update = { creditDays, updatedAt: serverTimestamp(), lastLogId: lRef.id };
      if (lastAttendanceId !== undefined) update.lastAttendanceId = lastAttendanceId;
      batch.update(doc(db, `students/${id}`), update);
      batch.set(lRef, {
        type: 'attendance',
        studentId: id,
        targetUid: null,
        message: 'x',
        actorUid: TEACHER.uid,
        actorName: TEACHER.name,
        actorRole: 'teacher',
        createdAt: serverTimestamp(),
      });
      return batch.commit();
    };
    await assertFails(bump(1));
    await assertFails(bump(5));
    await assertFails(bump(1, `${id}_2026-10-05`));
    // Pointing at an existing credited record that is not changing also fails.
    await setAttendance(teacherDb(), TEACHER, id, { date: '2026-10-05', status: 'absent', note: '', policy: 'all' });
    expect((await read(`students/${id}`)).creditDays).toBe(1);
    await assertFails(bump(2, `${id}_2026-10-05`));
    // ...or at another student's record.
    const otherId = await newChild(otherDb(), OTHER, { ...CHILD, firstName: 'Leo' });
    await assertFails(bump(2, `${otherId}_2026-10-05`));
  });

  it('attendance cannot be pointed at another parent', async () => {
    const id = await newChild();
    const db = teacherDb();
    const batch = writeBatch(db);
    const lRef = doc(collection(db, 'logs'));
    batch.set(doc(db, `attendance/${id}_2026-10-05`), {
      studentId: id,
      parentUid: OTHER.uid,
      date: '2026-10-05',
      status: 'present',
      note: '',
      credited: false,
      logId: lRef.id,
      updatedBy: TEACHER.uid,
      updatedByName: TEACHER.name,
      updatedAt: serverTimestamp(),
    });
    batch.update(doc(db, `students/${id}`), { updatedAt: serverTimestamp(), lastLogId: lRef.id });
    batch.set(lRef, {
      type: 'attendance',
      studentId: id,
      targetUid: null,
      message: 'x',
      actorUid: TEACHER.uid,
      actorName: TEACHER.name,
      actorRole: 'teacher',
      createdAt: serverTimestamp(),
    });
    await assertFails(batch.commit());
  });
});

// ===========================================================================
describe('logs', () => {
  it('staff can read logs, parents cannot', async () => {
    await newChild();
    await assertSucceeds(getDocs(collection(teacherDb(), 'logs')));
    await assertSucceeds(getDocs(collection(adminDb(), 'logs')));
    await assertFails(getDocs(collection(parentDb(), 'logs')));
  });

  it('logs are append-only for everyone but the super admin\'s reset', async () => {
    await newChild();
    const [log] = await readAll('logs');
    await assertFails(updateDoc(doc(adminDb(), `logs/${log.id}`), { message: 'nothing happened' }));
    await assertFails(deleteDoc(doc(teacherDb(), `logs/${log.id}`)));
    await assertFails(deleteDoc(doc(parentDb(), `logs/${log.id}`)));
  });

  it('a log cannot be forged in someone else\'s name or role', async () => {
    const id = await newChild();
    const student = { id, ...(await read(`students/${id}`)) };
    await assertFails(updateStudentProfile(parentDb(), { ...PARENT, role: 'teacher' }, student, { ...CHILD, grade: '3rd' }));
    const db = parentDb();
    const batch = writeBatch(db);
    const lRef = doc(collection(db, 'logs'));
    batch.update(doc(db, `students/${id}`), { grade: '3rd', updatedAt: serverTimestamp(), lastLogId: lRef.id });
    batch.set(lRef, {
      type: 'student_updated',
      studentId: id,
      targetUid: null,
      message: 'x',
      actorUid: TEACHER.uid, // pretending to be the teacher
      actorName: TEACHER.name,
      actorRole: 'parent',
      createdAt: serverTimestamp(),
    });
    await assertFails(batch.commit());
  });

  it('a standalone log entry (not tied to a change) is rejected', async () => {
    const id = await newChild();
    await assertFails(
      setDoc(doc(collection(teacherDb(), 'logs')), {
        type: 'payment',
        studentId: id,
        targetUid: null,
        message: 'Fake payment',
        actorUid: TEACHER.uid,
        actorName: TEACHER.name,
        actorRole: 'teacher',
        createdAt: serverTimestamp(),
      }),
    );
  });
});

// ===========================================================================
describe('settings', () => {
  const settings = {
    clubName: 'Max TC',
    currency: '$',
    monthlyFeeCents: 6000,
    absencePolicy: 'excused',
    expiringSoonDays: 5,
    clubDays: [1, 2, 3, 4, 5],
  };

  it('only the super admin can change settings', async () => {
    await assertFails(saveSettings(teacherDb(), TEACHER, settings));
    await assertFails(saveSettings(parentDb(), PARENT, settings));
    await assertFails(saveSettings(ctx(ADMIN, { verified: false }), ADMIN, settings));
    await assertSucceeds(saveSettings(adminDb(), ADMIN, settings));
    expect((await read('settings/club')).absencePolicy).toBe('excused');
  });

  it('rejects invalid settings', async () => {
    await assertFails(saveSettings(adminDb(), ADMIN, { ...settings, absencePolicy: 'free' }));
    await assertFails(saveSettings(adminDb(), ADMIN, { ...settings, clubDays: [9] }));
    await assertFails(saveSettings(adminDb(), ADMIN, { ...settings, monthlyFeeCents: -5 }));
  });

  it('verified users can read settings, anonymous visitors cannot', async () => {
    await seedSettings();
    await assertSucceeds(getDoc(doc(parentDb(), 'settings/club')));
    await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), 'settings/club')));
  });
});

// ===========================================================================
describe('testing reset (super admin only)', () => {
  const pay = { amountCents: 10000, months: 1, method: 'cash', periodStart: '2026-10-01', note: '', currency: '$' };

  async function seedClub() {
    await seed(`users/${ADMIN.uid}`, userDoc(ADMIN, 'parent'));
    await seedSettings();
    const id = await newChild();
    await recordPayment(teacherDb(), TEACHER, id, pay);
    await setAttendance(teacherDb(), TEACHER, id, { date: '2026-10-05', status: 'present', note: 'ok', policy: 'charge' });
    return id;
  }

  it('clear history: deletes payments, attendance and logs, students go back to never paid', async () => {
    const id = await seedClub();
    expect(await countResetData(adminDb())).toMatchObject({ payments: 1, attendance: 1, students: 1, users: 4 });
    const progress = [];
    await assertSucceeds(resetClubData(adminDb(), ADMIN, 'history', (done, total) => progress.push([done, total])));
    expect(progress.at(-1)).toEqual([6, 6]); // 1 payment + 1 attendance + 3 logs + 1 student reset
    for (const name of ['payments', 'attendance', 'logs']) expect(await readAll(name)).toHaveLength(0);
    expect(await read(`students/${id}`)).toMatchObject({
      ...CHILD, parentUid: PARENT.uid, status: 'active', paidUntil: null, totalPaidCents: 0, monthsPaid: 0, creditDays: 0, lastPaymentId: null, lastLogId: null,
    });
    expect(await readAll('users')).toHaveLength(4);
    expect(await read('settings/club')).not.toBe(null);
    // The club keeps working afterwards.
    await assertSucceeds(recordPayment(teacherDb(), TEACHER, id, pay));
    await assertSucceeds(updateStudentProfile(parentDb(), PARENT, { id, ...(await read(`students/${id}`)) }, { ...CHILD, grade: '3rd' }));
  });

  it('reset everything: only the super admin\'s own profile is left', async () => {
    await seedClub();
    await assertSucceeds(resetClubData(adminDb(), ADMIN, 'everything'));
    for (const name of ['payments', 'attendance', 'logs', 'students']) expect(await readAll(name)).toHaveLength(0);
    expect((await readAll('users')).map((u) => u.id)).toEqual([ADMIN.uid]);
    expect(await read('settings/club')).toBe(null);
  });

  it('teachers, parents and unverified admins cannot reset', async () => {
    const id = await seedClub();
    await assertFails(resetClubData(teacherDb(), TEACHER, 'history'));
    await assertFails(resetClubData(teacherDb(), TEACHER, 'everything'));
    await assertFails(resetClubData(parentDb(), PARENT, 'history'));
    await assertFails(resetClubData(ctx(ADMIN, { verified: false }), ADMIN, 'history'));
    expect(await readAll('payments')).toHaveLength(1);
    expect(await read(`students/${id}`)).toMatchObject({ totalPaidCents: 10000 });
  });

  it('a teacher cannot zero a student\'s billing the way the reset does', async () => {
    const id = await seedClub();
    await assertFails(
      updateDoc(doc(teacherDb(), `students/${id}`), {
        paidUntil: null, totalPaidCents: 0, monthsPaid: 0, creditDays: 0, lastPaymentAt: null,
        lastPaymentId: null, lastAttendanceId: null, lastLogId: null, updatedAt: serverTimestamp(),
      }),
    );
  });

  it('the super admin\'s reset update cannot be used to mark a student paid', async () => {
    const id = await seedClub();
    await assertFails(
      updateDoc(doc(adminDb(), `students/${id}`), {
        paidUntil: '2030-01-01', totalPaidCents: 0, monthsPaid: 0, creditDays: 0, lastPaymentAt: null,
        lastPaymentId: null, lastAttendanceId: null, lastLogId: null, updatedAt: serverTimestamp(),
      }),
    );
  });
});

// ===========================================================================
describe('everything else', () => {
  it('unknown collections are closed', async () => {
    await assertFails(setDoc(doc(adminDb(), 'secrets/x'), { a: 1 }));
    await assertFails(getDoc(doc(adminDb(), 'secrets/x')));
  });

  it('signed-out visitors cannot read anything', async () => {
    const id = await newChild();
    const anon = env.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(anon, `students/${id}`)));
    await assertFails(getDocs(collection(anon, 'payments')));
    await assertFails(getDocs(collection(anon, 'users')));
  });
});
