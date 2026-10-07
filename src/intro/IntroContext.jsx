import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import IntroOverlay from './IntroOverlay.jsx';

// Plays the intro once per browser session (replayable from the footer).
// Later page loads get a short shutter transition instead.

const KEY = 'maxtc.intro';
const IntroContext = createContext({ done: true, replay: () => {} });

function seen() {
  try {
    return sessionStorage.getItem(KEY) === 'seen';
  } catch {
    return false;
  }
}

function markSeen() {
  try {
    sessionStorage.setItem(KEY, 'seen');
  } catch {
    /* private mode: the intro just plays again next time */
  }
}

export function IntroProvider({ children }) {
  const [state, setState] = useState(() => (seen() ? 'curtain' : 'intro'));
  const finishIntro = useCallback(() => {
    markSeen();
    setState('done');
  }, []);
  const finishCurtain = useCallback(() => setState('done'), []);
  const replay = useCallback(() => setState('intro'), []);

  return (
    <IntroContext.Provider value={{ done: state === 'done', replay }}>
      {children}
      {state === 'intro' && <IntroOverlay onDone={finishIntro} />}
      {state === 'curtain' && <Curtain onDone={finishCurtain} />}
    </IntroContext.Provider>
  );
}

export function useIntro() {
  return useContext(IntroContext);
}

// Loading → site: the orange shutter closes over the boot screen and opens on
// the page.
function Curtain({ onDone }) {
  const ref = useRef(null);
  useEffect(() => {
    const boot = document.getElementById('boot');
    const blocks = [...(ref.current?.children ?? [])];
    if (!boot || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      boot?.remove();
      onDone();
      return undefined;
    }
    let cancelled = false;
    const ease = 'cubic-bezier(.7,0,.3,1)';
    const close = blocks.map((b, i) =>
      b.animate([{ transform: 'translateY(101%)' }, { transform: 'translateY(0%)' }], {
        duration: 240,
        delay: i * 28,
        easing: ease,
        fill: 'forwards',
      }),
    );
    Promise.all(close.map((a) => a.finished))
      .then(() => {
        boot.remove();
        const open = blocks.map((b, i) =>
          b.animate([{ transform: 'translateY(0%)' }, { transform: 'translateY(-101%)' }], {
            duration: 360,
            delay: 50 + i * 28,
            easing: ease,
            fill: 'forwards',
          }),
        );
        return Promise.all(open.map((a) => a.finished));
      })
      .catch(() => boot.remove())
      .finally(() => {
        if (!cancelled) onDone();
      });
    return () => {
      cancelled = true;
    };
  }, [onDone]);

  return (
    <div className="wipe curtain" ref={ref} aria-hidden="true">
      {Array.from({ length: 7 }, (_, i) => (
        <span key={i} />
      ))}
    </div>
  );
}
