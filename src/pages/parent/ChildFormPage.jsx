import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { doc } from 'firebase/firestore';
import { db } from '../../firebase.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { useDocument } from '../../lib/useFirestore.js';
import { createStudent, PROFILE_FIELDS, updateStudentProfile } from '../../lib/api.js';
import { fullName } from '../../lib/billing.js';
import { ageFrom, isDateStr, todayStr } from '../../lib/dates.js';
import { friendlyError } from '../../lib/errors.js';
import { Empty, ErrorAlert, Field, Spinner } from '../../components/ui.jsx';

const EMPTY = Object.fromEntries(PROFILE_FIELDS.map((k) => [k, '']));

function validate(f) {
  const e = {};
  if (!f.firstName.trim()) e.firstName = 'Required.';
  if (!f.lastName.trim()) e.lastName = 'Required.';
  if (!isDateStr(f.dateOfBirth)) e.dateOfBirth = 'Pick the date of birth.';
  else {
    const age = ageFrom(f.dateOfBirth);
    if (f.dateOfBirth > todayStr()) e.dateOfBirth = 'Date of birth cannot be in the future.';
    else if (age > 18) e.dateOfBirth = 'The club is for children up to 18.';
  }
  if (!f.emergencyName.trim()) e.emergencyName = 'Required — someone we can call if we can’t reach you.';
  if (f.emergencyPhone.trim().length < 3) e.emergencyPhone = 'Enter a phone number.';
  return e;
}

export default function ChildFormPage({ mode, staff = false }) {
  const { studentId } = useParams();
  const { actor } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const editing = mode === 'edit';
  const { data: student, loading } = useDocument(() => (editing ? doc(db, 'students', studentId) : null), [editing, studentId]);
  const [form, setForm] = useState(EMPTY);
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (editing && student && !loaded) {
      setForm(Object.fromEntries(PROFILE_FIELDS.map((k) => [k, student[k] ?? ''])));
      setLoaded(true);
    }
  }, [editing, student, loaded]);

  const backTo = staff ? `/staff/students/${studentId}` : editing ? `/family/${studentId}` : '/family';
  const errors = validate(form);
  const show = (k) => (touched ? errors[k] : '');
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  if (editing && loading) return <Spinner />;
  if (editing && !student) {
    return (
      <div className="card">
        <Empty icon="🔍" title="Child not found">
          <Link to={staff ? '/staff' : '/family'}>Go back</Link>
        </Empty>
      </div>
    );
  }

  async function submit(e) {
    e.preventDefault();
    setTouched(true);
    setError('');
    if (Object.keys(errors).length) return;
    setBusy(true);
    try {
      if (editing) {
        const changed = await updateStudentProfile(db, actor, student, form);
        toast(changed ? 'Details saved' : 'Nothing to change');
        navigate(backTo);
      } else {
        const id = await createStudent(db, actor, form);
        toast(`${fullName(form)} is registered!`);
        navigate(`/family/${id}`);
      }
    } catch (err) {
      setError(friendlyError(err));
      setBusy(false);
    }
  }

  return (
    <div style={{ maxWidth: 760, margin: '0 auto' }}>
      <Link to={backTo} className="back-link">
        ← Back
      </Link>
      <div className="page-head">
        <div>
          <div className="eyebrow">{editing ? 'Edit details' : 'Enroll a child'}</div>
          <h1>{editing ? fullName(student) : 'Add a child'}</h1>
          <p className="muted">This information is only visible to you and the club staff.</p>
        </div>
      </div>
      <form className="card form" onSubmit={submit} noValidate>
        <ErrorAlert error={error} />
        <div className="grid grid-2">
          <Field label="First name" required error={show('firstName')}>
            {(id) => <input id={id} type="text" maxLength={50} value={form.firstName} onChange={set('firstName')} autoComplete="off" />}
          </Field>
          <Field label="Last name" required error={show('lastName')}>
            {(id) => <input id={id} type="text" maxLength={50} value={form.lastName} onChange={set('lastName')} autoComplete="off" />}
          </Field>
          <Field label="Date of birth" required error={show('dateOfBirth')}>
            {(id) => <input id={id} type="date" max={todayStr()} value={form.dateOfBirth} onChange={set('dateOfBirth')} />}
          </Field>
          <Field label="Grade / class" hint="Optional">
            {(id) => <input id={id} type="text" maxLength={30} value={form.grade} onChange={set('grade')} />}
          </Field>
        </div>
        <Field label="Allergies" hint="Food, medicine, insects… leave empty if none.">
          {(id) => <textarea id={id} maxLength={500} value={form.allergies} onChange={set('allergies')} />}
        </Field>
        <Field label="Medical notes" hint="Conditions, medication, anything staff should know.">
          {(id) => <textarea id={id} maxLength={1000} value={form.medicalNotes} onChange={set('medicalNotes')} />}
        </Field>
        <div className="grid grid-2">
          <Field label="Emergency contact name" required error={show('emergencyName')}>
            {(id) => <input id={id} type="text" maxLength={80} value={form.emergencyName} onChange={set('emergencyName')} />}
          </Field>
          <Field label="Emergency contact phone" required error={show('emergencyPhone')}>
            {(id) => <input id={id} type="tel" maxLength={30} value={form.emergencyPhone} onChange={set('emergencyPhone')} />}
          </Field>
        </div>
        <Field label="Who may pick up your child?" hint="Names (and relation) of the adults allowed to collect your child.">
          {(id) => <textarea id={id} maxLength={500} value={form.authorizedPickup} onChange={set('authorizedPickup')} />}
        </Field>
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <Link to={backTo} className="btn btn-ghost">
            Cancel
          </Link>
          <button className="btn btn-primary" disabled={busy}>
            {busy ? 'Saving…' : editing ? 'Save changes' : 'Register child'}
          </button>
        </div>
      </form>
    </div>
  );
}
