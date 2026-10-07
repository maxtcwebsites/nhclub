import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../firebase.js';
import { ensureUserProfile, signupInProgress } from '../lib/api.js';
import { STAFF_IDLE_TIMEOUT_MINUTES, SUPER_ADMIN_EMAIL } from '../config.js';

const AuthContext = createContext(null);

export function isSuperAdminUser(user) {
  return Boolean(user?.emailVerified && user.email?.toLowerCase() === SUPER_ADMIN_EMAIL);
}

export function AuthProvider({ children }) {
  // undefined = still loading, null = signed out
  const [user, setUser] = useState(undefined);
  const [profile, setProfile] = useState(undefined);
  const [profileError, setProfileError] = useState(null);
  const [signOutReason, setSignOutReason] = useState('');
  // Bumped after the email is verified so the UI re-reads user.emailVerified.
  const [authVersion, setAuthVersion] = useState(0);

  useEffect(() => onAuthStateChanged(auth, (u) => setUser(u ?? null)), []);

  useEffect(() => {
    if (!user) {
      setProfile(user === null ? null : undefined);
      return undefined;
    }
    setProfile(undefined);
    setProfileError(null);
    let creating = false;
    return onSnapshot(
      doc(db, 'users', user.uid),
      (snap) => {
        if (snap.exists()) {
          setProfile({ id: snap.id, ...snap.data() });
        } else if (!creating && !signupInProgress.current) {
          // First sign-in with Google, or an account created elsewhere.
          creating = true;
          ensureUserProfile(db, user).catch((err) => setProfileError(err));
        }
      },
      (err) => setProfileError(err),
    );
  }, [user]);

  const role = useMemo(() => {
    if (!user || !profile) return null;
    if (isSuperAdminUser(user)) return 'admin';
    if (user.emailVerified && profile.role === 'teacher') return 'teacher';
    return 'parent';
  }, [user, profile, authVersion]); // eslint-disable-line react-hooks/exhaustive-deps

  const refreshVerification = useCallback(async () => {
    if (!auth.currentUser) return false;
    await auth.currentUser.reload();
    if (!auth.currentUser.emailVerified) return false;
    // Force a new ID token so Firestore sees email_verified = true.
    await auth.currentUser.getIdToken(true);
    setAuthVersion((v) => v + 1);
    return true;
  }, []);

  const logout = useCallback(async (reason = '') => {
    setSignOutReason(reason);
    await signOut(auth);
  }, []);

  // Staff accounts can see every family's data, so sign them out when the
  // computer is left unattended.
  const isStaff = role === 'teacher' || role === 'admin';
  const lastActivity = useRef(Date.now());
  useEffect(() => {
    if (!isStaff) return undefined;
    lastActivity.current = Date.now();
    const mark = () => {
      lastActivity.current = Date.now();
    };
    const events = ['pointerdown', 'keydown', 'scroll', 'touchstart'];
    events.forEach((e) => window.addEventListener(e, mark, { passive: true }));
    const timer = setInterval(() => {
      if (Date.now() - lastActivity.current > STAFF_IDLE_TIMEOUT_MINUTES * 60 * 1000) {
        logout(`You were signed out after ${STAFF_IDLE_TIMEOUT_MINUTES} minutes of inactivity.`);
      }
    }, 30 * 1000);
    return () => {
      events.forEach((e) => window.removeEventListener(e, mark));
      clearInterval(timer);
    };
  }, [isStaff, logout]);

  const value = useMemo(() => {
    const actor =
      user && profile
        ? { uid: user.uid, name: profile.displayName || user.email, role }
        : null;
    return {
      user,
      profile,
      profileError,
      role,
      actor,
      isStaff,
      isAdmin: role === 'admin',
      emailVerified: Boolean(user?.emailVerified),
      loading: user === undefined || (user !== null && profile === undefined && !profileError),
      refreshVerification,
      logout,
      signOutReason,
      clearSignOutReason: () => setSignOutReason(''),
    };
  }, [user, profile, profileError, role, isStaff, refreshVerification, logout, signOutReason, authVersion]); // eslint-disable-line react-hooks/exhaustive-deps

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
