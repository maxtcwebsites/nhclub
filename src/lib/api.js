// Every write the app makes lives here. Each one is shaped to satisfy
// firestore.rules exactly: a student change is always committed together with
// a fresh audit-log entry, and billing changes always go through a new,
// immutable ledger entry. All functions take the Firestore instance as the
// first argument so the same code runs against the emulator in tests.

import {
  collection,
  doc,
  runTransaction,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore';
import { fullName, periodEndFor, resolveCredit } from './billing.js';
import { formatDate, isDateStr } from './dates.js';

export const PROFILE_FIELDS = [
  'firstName',
  'lastName',
  'dateOfBirth',
  'grade',
  'allergies',
  'medicalNotes',
  'emergencyName',
  'emergencyPhone',
  'authorizedPickup',
];

const PROFILE_LABELS = {
  firstName: 'first name',
  lastName: 'last name',
  dateOfBirth: 'date of birth',
  grade: 'grade',
  allergies: 'allergies',
  medicalNotes: 'medical notes',
  emergencyName: 'emergency contact',
  emergencyPhone: 'emergency phone',
  authorizedPickup: 'authorized pickup',
};

const clip = (text, max) => String(text ?? '').trim().slice(0, max);

export function cleanProfile(input) {
  return {
    firstName: clip(input.firstName, 50),
    lastName: clip(input.lastName, 50),
    dateOfBirth: clip(input.dateOfBirth, 10),
    grade: clip(input.grade, 30),
    allergies: clip(input.allergies, 500),
    medicalNotes: clip(input.medicalNotes, 1000),
    emergencyName: clip(input.emergencyName, 80),
    emergencyPhone: clip(input.emergencyPhone, 30),
    authorizedPickup: clip(input.authorizedPickup, 500),
  };
}

function newRef(db, path) {
  return doc(collection(db, path));
}

function logEntry(actor, { type, studentId = null, targetUid = null, message }) {
  return {
    type,
    studentId,
    targetUid,
    message: clip(message, 500) || type,
    actorUid: actor.uid,
    actorName: clip(actor.name, 80),
    actorRole: actor.role,
    createdAt: serverTimestamp(),
  };
}

// ---------------------------------------------------------------------------
// Profiles
// ---------------------------------------------------------------------------

// Set while the sign-up form is creating the profile itself, so the auth
// listener does not race it.
export const signupInProgress = { current: false };

export async function ensureUserProfile(db, user, extra = {}) {
  const ref = doc(db, 'users', user.uid);
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (snap.exists()) return false;
    tx.set(ref, {
      uid: user.uid,
      email: user.email,
      displayName: clip(extra.displayName || user.displayName || user.email.split('@')[0], 80) || 'Parent',
      phone: clip(extra.phone, 30),
      role: 'parent',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return true;
  });
}

export async function updateOwnProfile(db, user, { displayName, phone }) {
  const batch = writeBatch(db);
  batch.update(doc(db, 'users', user.uid), {
    displayName: clip(displayName, 80),
    phone: clip(phone, 30),
    email: user.email,
    updatedAt: serverTimestamp(),
  });
  await batch.commit();
}

export async function setUserRole(db, actor, target, role) {
  const batch = writeBatch(db);
  const logRef = newRef(db, 'logs');
  batch.update(doc(db, 'users', target.uid), {
    role,
    roleUpdatedBy: actor.uid,
    roleUpdatedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    roleLogId: logRef.id,
  });
  batch.set(
    logRef,
    logEntry(actor, {
      type: 'role_changed',
      targetUid: target.uid,
      message:
        role === 'teacher'
          ? `Promoted ${target.displayName} (${target.email}) to teacher`
          : `Removed teacher access from ${target.displayName} (${target.email})`,
    }),
  );
  await batch.commit();
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export async function saveSettings(db, actor, settings) {
  const batch = writeBatch(db);
  const logRef = newRef(db, 'logs');
  batch.set(doc(db, 'settings', 'club'), {
    clubName: clip(settings.clubName, 80),
    currency: clip(settings.currency, 5),
    monthlyFeeCents: settings.monthlyFeeCents,
    absencePolicy: settings.absencePolicy,
    expiringSoonDays: settings.expiringSoonDays,
    clubDays: [...settings.clubDays].sort(),
    updatedBy: actor.uid,
    updatedAt: serverTimestamp(),
    lastLogId: logRef.id,
  });
  batch.set(
    logRef,
    logEntry(actor, {
      type: 'settings_updated',
      message: `Updated club settings (absence policy: ${settings.absencePolicy}, monthly fee: ${(settings.monthlyFeeCents / 100).toFixed(2)})`,
    }),
  );
  await batch.commit();
}

// ---------------------------------------------------------------------------
// Students
// ---------------------------------------------------------------------------

export async function createStudent(db, actor, input) {
  const profile = cleanProfile(input);
  const batch = writeBatch(db);
  const studentRef = newRef(db, 'students');
  const logRef = newRef(db, 'logs');
  batch.set(studentRef, {
    ...profile,
    parentUid: actor.uid,
    status: 'active',
    paidUntil: null,
    totalPaidCents: 0,
    monthsPaid: 0,
    creditDays: 0,
    lastPaymentAt: null,
    lastPaymentId: null,
    lastAttendanceId: null,
    lastLogId: logRef.id,
    createdBy: actor.uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  batch.set(
    logRef,
    logEntry(actor, {
      type: 'student_created',
      studentId: studentRef.id,
      message: `${actor.name} registered ${fullName(profile)}`,
    }),
  );
  await batch.commit();
  return studentRef.id;
}

export async function updateStudentProfile(db, actor, student, input) {
  const profile = cleanProfile(input);
  const changed = PROFILE_FIELDS.filter((key) => profile[key] !== (student[key] ?? ''));
  if (changed.length === 0) return false;
  const batch = writeBatch(db);
  const logRef = newRef(db, 'logs');
  const update = { updatedAt: serverTimestamp(), lastLogId: logRef.id };
  for (const key of changed) update[key] = profile[key];
  batch.update(doc(db, 'students', student.id), update);
  batch.set(
    logRef,
    logEntry(actor, {
      type: 'student_updated',
      studentId: student.id,
      message: `Updated ${changed.map((k) => PROFILE_LABELS[k]).join(', ')} for ${fullName(profile)}`,
    }),
  );
  await batch.commit();
  return true;
}

export async function setStudentStatus(db, actor, student, status, reason = '') {
  const batch = writeBatch(db);
  const logRef = newRef(db, 'logs');
  batch.update(doc(db, 'students', student.id), {
    status,
    updatedAt: serverTimestamp(),
    lastLogId: logRef.id,
  });
  const verb = status === 'archived' ? 'Archived' : 'Re-activated';
  batch.set(
    logRef,
    logEntry(actor, {
      type: 'status_changed',
      studentId: student.id,
      message: `${verb} ${fullName(student)}${reason ? ` — ${reason}` : ''}`,
    }),
  );
  await batch.commit();
}

// ---------------------------------------------------------------------------
// Payments (append-only ledger)
// ---------------------------------------------------------------------------

async function writeLedgerEntry(db, actor, studentId, buildEntry) {
  return runTransaction(db, async (tx) => {
    const studentRef = doc(db, 'students', studentId);
    const snap = await tx.get(studentRef);
    if (!snap.exists()) throw new Error('Student not found.');
    const student = { id: snap.id, ...snap.data() };
    const { entry, message, type } = buildEntry(student);

    const paymentRef = newRef(db, 'payments');
    const logRef = newRef(db, 'logs');
    tx.set(paymentRef, {
      studentId,
      parentUid: student.parentUid,
      previousPaidUntil: student.paidUntil ?? null,
      previousCreditDays: student.creditDays ?? 0,
      createdBy: actor.uid,
      createdByName: clip(actor.name, 80),
      createdAt: serverTimestamp(),
      ...entry,
    });
    tx.update(studentRef, {
      paidUntil: entry.periodEnd,
      totalPaidCents: (student.totalPaidCents ?? 0) + entry.amountCents,
      monthsPaid: (student.monthsPaid ?? 0) + entry.months,
      creditDays: 0,
      lastPaymentAt: serverTimestamp(),
      lastPaymentId: paymentRef.id,
      updatedAt: serverTimestamp(),
      lastLogId: logRef.id,
    });
    tx.set(logRef, logEntry(actor, { type, studentId, message }));
    return paymentRef.id;
  });
}

export async function recordPayment(db, actor, studentId, { amountCents, months, method, periodStart, note, currency }) {
  if (!Number.isInteger(amountCents) || amountCents <= 0) throw new Error('Enter an amount greater than zero.');
  if (!Number.isInteger(months) || months < 1 || months > 24) throw new Error('Months must be between 1 and 24.');
  if (!isDateStr(periodStart)) throw new Error('Pick a start date.');
  const periodEnd = periodEndFor(periodStart, months);
  return writeLedgerEntry(db, actor, studentId, (student) => ({
    type: 'payment',
    entry: {
      kind: 'payment',
      amountCents,
      months,
      method,
      currency: clip(currency, 5),
      periodStart,
      periodEnd,
      note: clip(note, 500),
    },
    message: `Payment of ${currency}${(amountCents / 100).toFixed(2)} for ${months} month${months === 1 ? '' : 's'} (${formatDate(periodStart)} – ${formatDate(periodEnd)}) for ${fullName(student)}`,
  }));
}

export async function recordCorrection(db, actor, studentId, { newPaidUntil, amountCents, months, note, currency }) {
  if (!isDateStr(newPaidUntil)) throw new Error('Pick the new paid-until date.');
  if (!Number.isInteger(amountCents)) throw new Error('Enter a valid amount (use 0 for none).');
  if (!Number.isInteger(months) || months < -24 || months > 24) throw new Error('Months must be between -24 and 24.');
  if (clip(note, 500).length < 3) throw new Error('Please explain the reason for the correction.');
  return writeLedgerEntry(db, actor, studentId, (student) => ({
    type: 'correction',
    entry: {
      kind: 'correction',
      amountCents,
      months,
      method: 'adjustment',
      currency: clip(currency, 5),
      periodStart: null,
      periodEnd: newPaidUntil,
      note: clip(note, 500),
    },
    message: `Correction for ${fullName(student)}: paid until ${formatDate(student.paidUntil)} → ${formatDate(newPaidUntil)}, amount ${currency}${(amountCents / 100).toFixed(2)}, months ${months}. Reason: ${clip(note, 300)}`,
  }));
}

// ---------------------------------------------------------------------------
// Attendance
// ---------------------------------------------------------------------------

export const ATTENDANCE_LABELS = { present: 'Present', absent: 'Absent', excused: 'Excused' };

export async function setAttendance(db, actor, studentId, { date, status, note, policy }) {
  if (!isDateStr(date)) throw new Error('Invalid date.');
  if (!ATTENDANCE_LABELS[status]) throw new Error('Invalid status.');
  return runTransaction(db, async (tx) => {
    const studentRef = doc(db, 'students', studentId);
    const attendanceRef = doc(db, 'attendance', `${studentId}_${date}`);
    const studentSnap = await tx.get(studentRef);
    if (!studentSnap.exists()) throw new Error('Student not found.');
    const attendanceSnap = await tx.get(attendanceRef);
    const student = { id: studentSnap.id, ...studentSnap.data() };
    const previous = attendanceSnap.exists() ? attendanceSnap.data() : null;

    const credited = resolveCredit({ status, date, previous, student, policy });
    const delta = (credited ? 1 : 0) - (previous?.credited ? 1 : 0);
    const cleanNote = clip(note, 300);
    if (previous && previous.status === status && (previous.note ?? '') === cleanNote) {
      return { credited, changed: false };
    }

    const logRef = newRef(db, 'logs');
    tx.set(attendanceRef, {
      studentId,
      parentUid: student.parentUid,
      date,
      status,
      note: cleanNote,
      credited,
      logId: logRef.id,
      updatedBy: actor.uid,
      updatedByName: clip(actor.name, 80),
      updatedAt: serverTimestamp(),
    });
    tx.update(studentRef, {
      creditDays: (student.creditDays ?? 0) + delta,
      lastAttendanceId: attendanceRef.id,
      updatedAt: serverTimestamp(),
      lastLogId: logRef.id,
    });
    let message = `Marked ${fullName(student)} ${ATTENDANCE_LABELS[status].toLowerCase()} on ${formatDate(date)}`;
    if (previous && previous.status !== status) message += ` (was ${previous.status})`;
    if (cleanNote) message += ` — note: ${cleanNote}`;
    if (delta > 0) message += ' (+1 day added to subscription)';
    if (delta < 0) message += ' (absence credit removed)';
    tx.set(logRef, logEntry(actor, { type: 'attendance', studentId, message }));
    return { credited, changed: true };
  });
}

export async function clearAttendance(db, actor, studentId, date) {
  return runTransaction(db, async (tx) => {
    const studentRef = doc(db, 'students', studentId);
    const attendanceRef = doc(db, 'attendance', `${studentId}_${date}`);
    const studentSnap = await tx.get(studentRef);
    const attendanceSnap = await tx.get(attendanceRef);
    if (!studentSnap.exists() || !attendanceSnap.exists()) return false;
    const student = { id: studentSnap.id, ...studentSnap.data() };
    const previous = attendanceSnap.data();
    const logRef = newRef(db, 'logs');
    tx.delete(attendanceRef);
    tx.update(studentRef, {
      creditDays: (student.creditDays ?? 0) - (previous.credited ? 1 : 0),
      lastAttendanceId: attendanceRef.id,
      updatedAt: serverTimestamp(),
      lastLogId: logRef.id,
    });
    tx.set(
      logRef,
      logEntry(actor, {
        type: 'attendance_cleared',
        studentId,
        message: `Cleared attendance for ${fullName(student)} on ${formatDate(date)} (was ${previous.status})${previous.credited ? ' — absence credit removed' : ''}`,
      }),
    );
    return true;
  });
}
