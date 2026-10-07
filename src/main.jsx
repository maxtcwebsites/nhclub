import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './App.jsx';
import './styles.css';

const root = document.getElementById('root');

// GitHub Pages cannot send an X-Frame-Options header, so refuse to run inside
// another site's frame (protects against clickjacking).
if (window.self !== window.top) {
  root.textContent = 'For your security, this portal cannot be shown inside another website.';
} else {
  // Hash URLs (…/#/family) work on any static host, including GitHub Pages,
  // without server-side rewrites.
  createRoot(root).render(
    <StrictMode>
      <HashRouter>
        <App />
      </HashRouter>
    </StrictMode>,
  );
}
