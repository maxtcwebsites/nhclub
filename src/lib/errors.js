const MESSAGES = {
  // Auth. Wrong email and wrong password share one message on purpose so the
  // site never reveals which emails have an account.
  'auth/invalid-credential': 'Email or password is incorrect.',
  'auth/wrong-password': 'Email or password is incorrect.',
  'auth/user-not-found': 'Email or password is incorrect.',
  'auth/invalid-email': 'Please enter a valid email address.',
  'auth/missing-password': 'Please enter your password.',
  'auth/user-disabled': 'This account has been disabled. Please contact the club.',
  'auth/email-already-in-use': 'An account with this email already exists. Try signing in instead.',
  'auth/weak-password': 'Please choose a stronger password.',
  'auth/password-does-not-meet-requirements': 'Please choose a stronger password.',
  'auth/too-many-requests': 'Too many attempts. Please wait a few minutes and try again.',
  'auth/popup-closed-by-user': 'The sign-in window was closed before finishing.',
  'auth/cancelled-popup-request': 'The sign-in window was closed before finishing.',
  'auth/popup-blocked': 'Your browser blocked the sign-in window. Allow pop-ups for this site and try again.',
  'auth/network-request-failed': 'Network problem. Check your connection and try again.',
  'auth/operation-not-allowed': 'This sign-in method is not enabled yet. Please contact the club.',
  'auth/requires-recent-login': 'For your security, please sign out and sign in again first.',
  'auth/account-exists-with-different-credential':
    'This email is already registered with a password. Sign in with your email and password.',
  // Firestore
  'permission-denied': 'You do not have permission to do that. If you were just given access, refresh the page.',
  'aborted': 'Someone else changed this record at the same moment. Please try again.',
  'failed-precondition': 'This record changed while you were working. Please try again.',
  'unavailable': 'You appear to be offline. Check your connection and try again.',
  'not-found': 'That record no longer exists.',
};

export function friendlyError(error) {
  if (!error) return '';
  const code = error.code?.replace(/^firestore\//, '');
  if (code && MESSAGES[code]) return MESSAGES[code];
  if (error.message && !code) return error.message;
  return 'Something went wrong. Please try again.';
}

export function passwordProblems(password) {
  const problems = [];
  if (password.length < 8) problems.push('at least 8 characters');
  if (!/[A-Za-z]/.test(password)) problems.push('a letter');
  if (!/\d/.test(password)) problems.push('a number');
  return problems;
}
