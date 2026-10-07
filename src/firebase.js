import { initializeApp } from 'firebase/app';
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';
import { connectAuthEmulator, getAuth } from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore';
import { ENABLE_ANALYTICS } from './config.js';

// Firebase web config is public by design: access is controlled by
// Firebase Auth + firestore.rules, not by hiding these values.
const firebaseConfig = {
  apiKey: 'AIzaSyACeEc73LmNt0PiX5KnhNQrj33570Ce7ik',
  authDomain: 'nhclub-1260c.firebaseapp.com',
  projectId: 'nhclub-1260c',
  storageBucket: 'nhclub-1260c.firebasestorage.app',
  messagingSenderId: '243351735119',
  appId: '1:243351735119:web:94b44669afd9994f49533a',
  measurementId: 'G-MW1QK2DNT4',
};

export const app = initializeApp(firebaseConfig);

const useEmulators = import.meta.env.VITE_USE_EMULATORS === 'true';

// Optional: Firebase App Check blocks requests that do not come from this
// website. Create a reCAPTCHA v3 key, put it in .env.local as
// VITE_RECAPTCHA_SITE_KEY=..., then turn on enforcement in the console.
const appCheckKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY;
if (appCheckKey && !useEmulators) {
  initializeAppCheck(app, {
    provider: new ReCaptchaV3Provider(appCheckKey),
    isTokenAutoRefreshEnabled: true,
  });
}

export const auth = getAuth(app);
export const db = getFirestore(app);

if (useEmulators) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
}

if (ENABLE_ANALYTICS && import.meta.env.PROD && !useEmulators) {
  import('firebase/analytics')
    .then(async ({ getAnalytics, isSupported }) => {
      if (await isSupported()) getAnalytics(app);
    })
    .catch(() => {});
}
