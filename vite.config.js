import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// `vite preview` serves the build with the same security headers as Firebase
// Hosting (firebase.json is the single source of truth), so CSP problems show
// up locally before deploying.
function hostingHeaders(useEmulators) {
  const hosting = JSON.parse(readFileSync(new URL('./firebase.json', import.meta.url), 'utf8')).hosting;
  const headers = {};
  for (const { key, value } of hosting.headers[0].headers) {
    if (key === 'Strict-Transport-Security') continue;
    let v = value;
    if (key === 'Content-Security-Policy') {
      v = v.replace('; upgrade-insecure-requests', '');
      if (useEmulators) v = v.replace("connect-src 'self'", "connect-src 'self' http://127.0.0.1:9099 http://127.0.0.1:8080");
    }
    headers[key] = v;
  }
  return headers;
}

export default defineConfig(({ mode }) => {
  const useEmulators = process.env.VITE_USE_EMULATORS === 'true';
  return {
    plugins: [react()],
    build: {
      sourcemap: false,
      target: 'es2020',
      // The Firebase SDK alone is ~550 kB; it is cached long-term by the browser.
      chunkSizeWarningLimit: 700,
    },
    preview: {
      headers: mode === 'production' ? hostingHeaders(useEmulators) : {},
    },
  };
});
