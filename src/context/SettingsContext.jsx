import { createContext, useContext, useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase.js';
import { DEFAULT_SETTINGS } from '../lib/billing.js';
import { useAuth } from './AuthContext.jsx';

const SettingsContext = createContext({ settings: DEFAULT_SETTINGS, saved: false, loaded: false });

export function SettingsProvider({ children }) {
  const { user, emailVerified } = useAuth();
  const [state, setState] = useState({ settings: DEFAULT_SETTINGS, saved: false, loaded: false });

  useEffect(() => {
    if (!user || !emailVerified) {
      setState({ settings: DEFAULT_SETTINGS, saved: false, loaded: false });
      return undefined;
    }
    return onSnapshot(
      doc(db, 'settings', 'club'),
      (snap) =>
        setState({
          settings: snap.exists() ? { ...DEFAULT_SETTINGS, ...snap.data() } : DEFAULT_SETTINGS,
          saved: snap.exists(),
          loaded: true,
        }),
      () => setState({ settings: DEFAULT_SETTINGS, saved: false, loaded: true }),
    );
  }, [user, emailVerified]);

  return <SettingsContext.Provider value={state}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  return useContext(SettingsContext);
}
