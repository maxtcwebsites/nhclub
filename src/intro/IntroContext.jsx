import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import IntroOverlay from './IntroOverlay.jsx';

// The intro is off by default: it plays from Settings ("Ver la intro"), or on
// opening the site if the person turns that on in Settings (saved per device,
// once per browser session). Otherwise page loads get a short shutter
// transition.

const SEEN_KEY = 'aclub.intro';
const AUTOPLAY_KEY = 'aclub.introOnOpen';
const IntroContext = createContext({ done: true, replay: () => {}, autoplay: false, setAutoplay: () => {} });

function seen() {
  try {
    return sessionStorage.getItem(SEEN_KEY) === 'seen';
  } catch {
    return false;
  }
}

function markSeen() {
  try {
    sessionStorage.setItem(SEEN_KEY, 'seen');
  } catch {
    /* private mode: nothing to remember */
  }
}

function readAutoplay() {
  try {
    return localStorage.getItem(AUTOPLAY_KEY) === 'on';
  } catch {
    return false;
  }
}

export function IntroProvider({ children }) {
  const [autoplay, setAutoplayState] = useState(readAutoplay);
  const [state, setState] = useState(() => (autoplay && !seen() ? 'intro' : 'curtain'));
  const finishIntro = useCallback(() => {
    markSeen();
    setState('done');
  }, []);
  const finishCurtain = useCallback(() => setState('done'), []);
  const replay = useCallback(() => setState('intro'), []);
  const setAutoplay = useCallback((on) => {
    setAutoplayState(on);
    try {
      if (on) localStorage.setItem(AUTOPLAY_KEY, 'on');
      else localStorage.removeItem(AUTOPLAY_KEY);
    } catch {
      /* storage blocked: the choice lasts until the page is closed */
    }
  }, []);

  return (
    <IntroContext.Provider value={{ done: state === 'done', replay, autoplay, setAutoplay }}>
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
