import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// firebase.json is the single source of truth for the security headers.
function securityHeaders() {
  const hosting = JSON.parse(readFileSync(new URL('./firebase.json', import.meta.url), 'utf8')).hosting;
  return Object.fromEntries(hosting.headers[0].headers.map(({ key, value }) => [key, value]));
}

function withEmulators(csp, useEmulators) {
  if (!useEmulators) return csp;
  return csp
    .replace('; upgrade-insecure-requests', '')
    .replace("connect-src 'self'", "connect-src 'self' http://127.0.0.1:9099 http://127.0.0.1:8080");
}

// GitHub Pages cannot send HTTP headers, so the Content-Security-Policy is
// also embedded as a <meta> tag in the built index.html. (frame-ancestors is
// not allowed in a meta tag; src/main.jsx refuses to run inside a frame
// instead.)
function cspMetaTag(useEmulators) {
  return {
    name: 'csp-meta-tag',
    apply: 'build',
    transformIndexHtml() {
      const csp = withEmulators(securityHeaders()['Content-Security-Policy'], useEmulators)
        .split('; ')
        .filter((directive) => !directive.startsWith('frame-ancestors'))
        .join('; ');
      return [{ tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: csp }, injectTo: 'head-prepend' }];
    },
  };
}

// `vite preview` serves the build with the same headers as Firebase Hosting,
// so CSP problems show up locally before deploying.
function previewHeaders(useEmulators) {
  const headers = securityHeaders();
  delete headers['Strict-Transport-Security'];
  headers['Content-Security-Policy'] = withEmulators(headers['Content-Security-Policy'], useEmulators).replace(
    '; upgrade-insecure-requests',
    '',
  );
  return headers;
}

export default defineConfig(({ mode }) => {
  const useEmulators = process.env.VITE_USE_EMULATORS === 'true';
  return {
    // Relative paths: the same build works at https://<user>.github.io/nhclub/,
    // on a custom domain and on Firebase Hosting.
    base: './',
    plugins: [react(), cspMetaTag(useEmulators)],
    build: {
      sourcemap: false,
      target: 'es2020',
      // The Firebase SDK alone is ~550 kB; it is cached long-term by the browser.
      chunkSizeWarningLimit: 700,
    },
    preview: {
      headers: mode === 'production' ? previewHeaders(useEmulators) : {},
    },
  };
});
