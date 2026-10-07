import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { collection, doc } from 'firebase/firestore';
import { db } from '../../firebase.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { useI18n } from '../../i18n/I18nContext.jsx';
import { useCollection, useDocument } from '../../lib/useFirestore.js';
import { createStudent, PROFILE_FIELDS, updateStudentProfile } from '../../lib/api.js';
import { fullName } from '../../lib/billing.js';
import { ageFrom, isDateStr, todayStr } from '../../lib/dates.js';
import { friendlyError } from '../../lib/errors.js';
import { Empty, ErrorAlert, Field, Spinner } from '../../components/ui.jsx';

const EMPTY = Object.fromEntries(PROFILE_FIELDS.map((k) => [k, '']));

// Staff enrollment: choose which family account the child belongs to.
function FamilyPicker({ value, onChange, error }) {
  const { t } = useI18n();
  const users = useCollection(() => collection(db, 'users'), []);
  const students = useCollection(() => collection(db, 'students'), []);
  const [search, setSearch] = useState('');

  const kids = useMemo(() => {
    const map = {};
    students.data.forEach((s) => {
      if (s.status !== 'archived') map[s.parentUid] = (map[s.parentUid] || 0) + 1;
    });
    return map;
  }, [students.data]);

  const term = search.trim().toLowerCase();
  const list = users.data
    .filter((u) => u.id === value?.uid || !term || `${u.displayName} ${u.email} ${u.phone}`.toLowerCase().includes(term))
    .sort((a, b) => (a.id === value?.uid ? -1 : b.id === value?.uid ? 1 : a.displayName.localeCompare(b.displayName)));

  return (
    <fieldset className="field family-picker">
      <legend className="label">
        {t('childForm.family')} <span className="req">*</span>
      </legend>
      <input
        type="search"
        placeholder={t('childForm.familySearch')}
        aria-label={t('childForm.familySearch')}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <ErrorAlert error={users.error} />
      <div className="family-list" role="radiogroup" aria-label={t('childForm.family')} aria-invalid={Boolean(error)}>
        {users.loading ? (
          <div className="family-empty">{t('common.loading')}</div>
        ) : list.length === 0 ? (
          <div className="family-empty">{users.data.length ? t('childForm.familyNoMatch') : t('childForm.familyNone')}</div>
        ) : (
          list.map((u) => (
            <label key={u.id} className={`family-option ${value?.uid === u.id ? 'on' : ''}`}>
              <input type="radio" name="family" checked={value?.uid === u.id} onChange={() => onChange({ ...u, uid: u.id })} />
              <span className="family-who">
                <strong>{u.displayName}</strong>
                <span className="sub">
                  {u.email}
                  {u.phone ? ` / ${u.phone}` : ''}
                </span>
              </span>
              {kids[u.id] > 0 && <span className="family-kids">{t('childForm.familyKids', { n: kids[u.id] })}</span>}
            </label>
          ))
        )}
      </div>
      {error ? <span className="error-text">{error}</span> : <span className="hint">{t('childForm.familyHint')}</span>}
    </fieldset>
  );
}

function validate(f, t) {
  const e = {};
  if (!f.firstName.trim()) e.firstName = t('childForm.required');
  if (!f.lastName.trim()) e.lastName = t('childForm.required');
  if (!isDateStr(f.dateOfBirth)) e.dateOfBirth = t('childForm.dobPick');
  else {
    const age = ageFrom(f.dateOfBirth);
    if (f.dateOfBirth > todayStr()) e.dateOfBirth = t('childForm.dobFuture');
    else if (age > 18) e.dateOfBirth = t('childForm.dobMax');
  }
  if (!f.emergencyName.trim()) e.emergencyName = t('childForm.emergencyReq');
  if (f.emergencyPhone.trim().length < 3) e.emergencyPhone = t('childForm.phoneReq');
  return e;
}

export default function ChildFormPage({ mode, staff = false }) {
  const { studentId } = useParams();
  const { actor } = useAuth();
  const { t } = useI18n();
  const toast = useToast();
  const navigate = useNavigate();
  const editing = mode === 'edit';
  const enrolling = staff && !editing;
  const { data: student, loading } = useDocument(() => (editing ? doc(db, 'students', studentId) : null), [editing, studentId]);
  const [form, setForm] = useState(EMPTY);
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [family, setFamily] = useState(null);

  useEffect(() => {
    if (editing && student && !loaded) {
      setForm(Object.fromEntries(PROFILE_FIELDS.map((k) => [k, student[k] ?? ''])));
      setLoaded(true);
    }
  }, [editing, student, loaded]);

  const backTo = enrolling ? '/staff' : staff ? `/staff/students/${studentId}` : editing ? `/family/${studentId}` : '/family';
  const errors = validate(form, t);
  if (staff && errors.emergencyName) errors.emergencyName = t('childForm.staffEmergencyReq');
  if (enrolling && !family) errors.family = t('childForm.familyPick');
  const show = (k) => (touched ? errors[k] : '');
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  if (editing && loading) return <Spinner />;
  if (editing && !student) {
    return (
      <div className="card">
        <Empty code="404" title={t('child.notFound')}>
          <Link to={staff ? '/staff' : '/family'}>{t('child.backFamily')}</Link>
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
        toast(changed ? t('childForm.saved') : t('childForm.nothing'));
        navigate(backTo);
      } else if (enrolling) {
        const id = await createStudent(db, actor, form, family);
        toast(t('childForm.enrolled', { name: fullName(form) }));
        navigate(`/staff/students/${id}`);
      } else {
        const id = await createStudent(db, actor, form);
        toast(t('childForm.registered', { name: fullName(form) }));
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
        {t('childForm.back')}
      </Link>
      <div className="page-head">
        <div>
          <div className="eyebrow">{editing ? t('childForm.editEyebrow') : enrolling ? t('childForm.enrollEyebrow') : t('childForm.newEyebrow')}</div>
          <h1>{editing ? fullName(student) : enrolling ? t('childForm.enrollTitle') : t('childForm.newTitle')}</h1>
          <p className="muted">{enrolling ? t('childForm.enrollPrivate') : t('childForm.private')}</p>
        </div>
      </div>
      <form className="card form" onSubmit={submit} noValidate>
        <ErrorAlert error={error} />
        {enrolling && <FamilyPicker value={family} onChange={setFamily} error={show('family')} />}
        <div className="grid grid-2">
          <Field label={t('field.firstName')} required error={show('firstName')}>
            {(id) => <input id={id} type="text" maxLength={50} value={form.firstName} onChange={set('firstName')} autoComplete="off" />}
          </Field>
          <Field label={t('field.lastName')} required error={show('lastName')}>
            {(id) => <input id={id} type="text" maxLength={50} value={form.lastName} onChange={set('lastName')} autoComplete="off" />}
          </Field>
          <Field label={t('field.dateOfBirth')} required error={show('dateOfBirth')}>
            {(id) => <input id={id} type="date" max={todayStr()} value={form.dateOfBirth} onChange={set('dateOfBirth')} />}
          </Field>
          <Field label={t('field.grade')} hint={t('common.optional')}>
            {(id) => <input id={id} type="text" maxLength={30} value={form.grade} onChange={set('grade')} />}
          </Field>
        </div>
        <Field label={t('field.allergies')} hint={t('childForm.allergiesHint')}>
          {(id) => <textarea id={id} maxLength={500} value={form.allergies} onChange={set('allergies')} />}
        </Field>
        <Field label={t('field.medicalNotes')} hint={t('childForm.medicalHint')}>
          {(id) => <textarea id={id} maxLength={1000} value={form.medicalNotes} onChange={set('medicalNotes')} />}
        </Field>
        <div className="grid grid-2">
          <Field label={t('childForm.emergencyName')} required error={show('emergencyName')}>
            {(id) => <input id={id} type="text" maxLength={80} value={form.emergencyName} onChange={set('emergencyName')} />}
          </Field>
          <Field label={t('childForm.emergencyPhone')} required error={show('emergencyPhone')}>
            {(id) => <input id={id} type="tel" maxLength={30} value={form.emergencyPhone} onChange={set('emergencyPhone')} />}
          </Field>
        </div>
        <Field label={staff ? t('childForm.staffPickupLabel') : t('childForm.pickupLabel')} hint={t('childForm.pickupHint')}>
          {(id) => <textarea id={id} maxLength={500} value={form.authorizedPickup} onChange={set('authorizedPickup')} />}
        </Field>
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <Link to={backTo} className="btn btn-ghost">
            {t('common.cancel')}
          </Link>
          <button className="btn btn-primary" disabled={busy}>
            {busy ? t('common.saving') : editing ? t('childForm.submitEdit') : enrolling ? t('childForm.submitEnroll') : t('childForm.submitNew')}
          </button>
        </div>
      </form>
    </div>
  );
}
