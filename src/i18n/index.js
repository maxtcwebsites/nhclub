// Tiny translation layer. Spanish is the default; English is the other
// option. Works outside React too (errors, dates, audit-log text), so the
// current language lives here and the React provider keeps it in sync.

import es from './es.js';
import en from './en.js';

export const DICTIONARIES = { es, en };
export const LANGUAGES = [
  { code: 'es', name: 'Español', short: 'ES', locale: 'es-ES' },
  { code: 'en', name: 'English', short: 'EN', locale: 'en-US' },
];
export const DEFAULT_LANG = 'es';

let current = DEFAULT_LANG;

export function setCurrentLang(code) {
  current = DICTIONARIES[code] ? code : DEFAULT_LANG;
  return current;
}

export function getLang() {
  return current;
}

export function getLocale() {
  return LANGUAGES.find((l) => l.code === current)?.locale ?? 'es-ES';
}

function lookup(dict, key) {
  let node = dict;
  for (const part of key.split('.')) {
    if (node == null || typeof node !== 'object') return undefined;
    node = node[part];
  }
  return node;
}

// tr('nav.settings') or tr('time.daysLeft', { n: 3 }).
// Values are strings with {placeholders} or functions of the variables.
export function tr(key, vars = {}) {
  const value = lookup(DICTIONARIES[current], key) ?? lookup(DICTIONARIES[DEFAULT_LANG], key);
  if (value === undefined) return key;
  if (typeof value === 'function') return value(vars);
  return String(value).replace(/\{(\w+)\}/g, (_, name) => (vars[name] ?? `{${name}}`));
}
