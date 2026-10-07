import { CREST_URL, PIECES, pieceStyle } from '../lib/crest.js';

// The club crest. `split` renders it as three separate panels (for motion).
export default function Crest({ split = false, className = '', label = 'Max TC crest' }) {
  if (!split) return <img className={`crest-img ${className}`} src={CREST_URL} alt={label} draggable="false" />;
  return (
    <div className={`crest ${className}`} role="img" aria-label={label}>
      {PIECES.map((p, i) => (
        <span key={p.id} className={`crest-piece crest-${p.id}`} style={pieceStyle(p, i)}>
          <img src={p.src} alt="" draggable="false" />
        </span>
      ))}
    </div>
  );
}

// Loading motion graphic: the crest keeps taking itself apart and rebuilding.
export function CrestLoader({ label = 'Loading', dark = false }) {
  return (
    <div className={`loader ${dark ? 'loader-dark' : ''}`} role="status" aria-label={label}>
      <Crest split className="loader-crest" label="" />
      <div className="loader-bar" aria-hidden="true">
        <span />
      </div>
      <div className="loader-text" aria-hidden="true">
        {label.toUpperCase()}
        <span className="loader-cursor" />
      </div>
    </div>
  );
}
