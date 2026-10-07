import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { auth } from '../firebase.js';
import { DEFAULT_LANG, DICTIONARIES, getLang, LANGUAGES, setCurrentLang, tr } from './index.js';

const KEY = 'aclub.lang';
const I18nContext = createContext({ lang: DEFAULT_LANG, setLang: () => {}, t: tr, languages: LANGUAGES });

function savedLang() {
  try {
    const value = localStorage.getItem(KEY);
    return DICTIONARIES[value] ? value : DEFAULT_LANG;
  } catch {
    return DEFAULT_LANG;
  }
}

export function I18nProvider({ children }) {
  const [lang, setLangState] = useState(() => setCurrentLang(savedLang()));

  const setLang = useCallback((code) => {
    const next = setCurrentLang(code);
    try {
      localStorage.setItem(KEY, next);
    } catch {
      /* the choice just isn't remembered */
    }
    setLangState(next);
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
    // Verification and password-reset emails from Firebase use this language.
    auth.languageCode = lang;
  }, [lang]);

  // A new value object on every change makes every page re-render in the
  // new language. `t` reads the module-level language, which is already set.
  const value = useMemo(() => ({ lang, setLang, t: (key, vars) => tr(key, vars), languages: LANGUAGES }), [lang, setLang]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  return useContext(I18nContext);
}

export { getLang };
