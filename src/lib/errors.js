import { tr } from '../i18n/index.js';

// Firebase error code -> translation key under "errors". Wrong email and
// wrong password share one message on purpose so the site never reveals which
// emails have an account.
const CODES = {
  'auth/invalid-credential': 'badLogin',
  'auth/wrong-password': 'badLogin',
  'auth/user-not-found': 'badLogin',
  'auth/invalid-email': 'invalidEmail',
  'auth/missing-password': 'missingPassword',
  'auth/user-disabled': 'userDisabled',
  'auth/email-already-in-use': 'emailInUse',
  'auth/weak-password': 'weakPassword',
  'auth/password-does-not-meet-requirements': 'weakPassword',
  'auth/too-many-requests': 'tooManyRequests',
  'auth/popup-closed-by-user': 'popupClosed',
  'auth/cancelled-popup-request': 'popupClosed',
  'auth/popup-blocked': 'popupBlocked',
  'auth/network-request-failed': 'network',
  'auth/operation-not-allowed': 'notAllowed',
  'auth/unauthorized-domain': 'unauthorizedDomain',
  'auth/requires-recent-login': 'recentLogin',
  'auth/account-exists-with-different-credential': 'differentCredential',
  'permission-denied': 'permissionDenied',
  aborted: 'aborted',
  'failed-precondition': 'failedPrecondition',
  unavailable: 'offline',
  'not-found': 'notFound',
};

export function friendlyError(error) {
  if (!error) return '';
  const code = error.code?.replace(/^firestore\//, '');
  if (code && CODES[code]) return tr(`errors.${CODES[code]}`);
  if (error.message && !code) return error.message;
  return tr('errors.generic');
}

export function passwordProblems(password) {
  const problems = [];
  if (password.length < 8) problems.push(tr('auth.pwMin'));
  if (!/[A-Za-z]/.test(password)) problems.push(tr('auth.pwLetter'));
  if (!/\d/.test(password)) problems.push(tr('auth.pwNumber'));
  return problems;
}
