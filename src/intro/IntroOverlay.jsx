import { useCallback, useEffect, useRef, useState } from 'react';
import { PIECES, pieceStyle } from '../lib/crest.js';
import { createSoundEngine, KICKS, NAME, playScore, SNARES, TIMELINE as T } from './sound.js';

// The intro: the crest floats in pieces until ENTER is pressed (browsers only
// allow sound after a click), then it is slammed together on the beat, the
// drop hits, "Max TC" is typed out, and an orange shutter reveals the site.

const BLOCKS = 7;
const COVER = 0.3; // seconds for one shutter block to close
const STAGGER = 0.035;

const prefersCalm = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const rand = (n) => (Math.random() * 2 - 1) * n;

// A panel pushed `k` times its "apart" offset. Every keyframe uses the same
// list of functions so the browser interpolates them cleanly.
function apart(p, k, jx = 0, jy = 0, sx = 1, sy = sx) {
  return `translate(${p.apart.x * k}%, ${p.apart.y * k}%) translate(${jx}px, ${jy}px) rotate(${p.apart.r * k}deg) scale(${sx}, ${sy})`;
}

export default function IntroOverlay({ onDone }) {
  const [phase, setPhase] = useState('gate'); // gate | playing | leaving
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;
  const [muted, setMuted] = useState(false);
  const phaseRef = useRef('gate');
  const mutedRef = useRef(false);
  const leaving = useRef(false);

  const root = useRef(null);
  const stage = useRef(null);
  const group = useRef(null);
  const crestPos = useRef(null);
  const crestFx = useRef(null);
  const pieceEls = useRef({});
  const shocks = useRef([]);
  const nameEl = useRef(null);
  const nameInner = useRef(null);
  const letterEls = useRef([]);
  const cursor = useRef(null);
  const underline = useRef(null);
  const particles = useRef(null);
  const flash = useRef(null);
  const viz = useRef(null);
  const timecode = useRef(null);
  const blockEls = useRef([]);

  const engine = useRef(null);
  const t0 = useRef(0);
  const energy = useRef(0);
  const timers = useRef([]);
  const anims = useRef([]);

  const goPhase = (p) => {
    phaseRef.current = p;
    setPhase(p);
  };

  // ---- timeline helpers (seconds from the start of the sequence) ---------

  const play = useCallback((el, frames, startSec, duration, opts = {}) => {
    if (!el) return null;
    const anim = el.animate(frames, { duration: duration * 1000, fill: 'forwards', easing: 'linear', ...opts });
    // The document timeline shares performance.now()'s clock.
    anim.startTime = t0.current + startSec * 1000;
    anims.current.push(anim);
    return anim;
  }, []);

  const at = useCallback((sec, fn) => {
    timers.current.push(setTimeout(fn, Math.max(0, t0.current + sec * 1000 - performance.now())));
  }, []);

  // ---- effects ------------------------------------------------------------

  const burst = useCallback((piece) => {
    const layer = particles.current;
    const box = crestFx.current?.getBoundingClientRect();
    if (!layer || !box) return;
    const [ax, ay] = { red: [0.32, 0.3], blue: [0.68, 0.3], green: [0.5, 0.7] }[piece.id];
    const cx = box.left + box.width * ax;
    const cy = box.top + box.height * ay;
    for (let i = 0; i < 18; i++) {
      const d = document.createElement('i');
      const size = 4 + Math.random() * 10;
      d.className = 'intro-particle';
      d.style.left = `${cx}px`;
      d.style.top = `${cy}px`;
      d.style.width = `${size}px`;
      d.style.height = `${size}px`;
      d.style.background = i % 3 === 0 ? '#ffffff' : i % 5 === 0 ? '#ff6b1a' : piece.color;
      layer.appendChild(d);
      const angle = Math.random() * Math.PI * 2;
      const dist = 80 + Math.random() * 190;
      const a = d.animate(
        [
          { transform: 'translate(-50%, -50%) rotate(0deg) scale(1)', opacity: 1 },
          {
            transform: `translate(calc(-50% + ${Math.cos(angle) * dist}px), calc(-50% + ${Math.sin(angle) * dist}px)) rotate(${rand(300)}deg) scale(0)`,
            opacity: 0.9,
          },
        ],
        { duration: 520 + Math.random() * 420, easing: 'cubic-bezier(.1,.8,.3,1)', fill: 'forwards' },
      );
      a.onfinish = () => d.remove();
    }
  }, []);

  const shake = useCallback((el, amp, ms) => {
    if (!el) return;
    const frames = [];
    for (let i = 0; i < 7; i++) {
      const k = amp * (1 - i / 7);
      frames.push({ transform: `translate(${rand(k)}px, ${rand(k)}px) rotate(${rand(k / 12)}deg)` });
    }
    frames.push({ transform: 'translate(0px, 0px) rotate(0deg)' });
    el.animate(frames, { duration: ms, easing: 'linear' });
  }, []);

  const flashOnce = useCallback((opacity, ms) => {
    flash.current?.animate([{ opacity }, { opacity: 0 }], { duration: ms, easing: 'ease-out' });
  }, []);

  // ---- exit: orange shutter closes, intro disappears, shutter opens -------

  const finish = useCallback(() => {
    const eng = engine.current;
    if (eng) setTimeout(() => eng.close(), 2800); // let the last hit ring out
    onDoneRef.current();
  }, []);

  const runExit = useCallback(
    (startSec) => {
      blockEls.current.forEach((b, i) =>
        play(b, [{ transform: 'translateY(101%)' }, { transform: 'translateY(0%)' }], startSec + i * STAGGER, COVER, {
          easing: 'cubic-bezier(.7,0,.3,1)',
        }),
      );
      const closed = startSec + COVER + (BLOCKS - 1) * STAGGER;
      at(closed, () => {
        goPhase('leaving');
        shake(root.current?.querySelector('.intro-wipe'), 8, 200);
      });
      blockEls.current.forEach((b, i) =>
        play(b, [{ transform: 'translateY(0%)' }, { transform: 'translateY(-101%)' }], closed + 0.12 + i * STAGGER, 0.42, {
          easing: 'cubic-bezier(.7,0,.3,1)',
        }),
      );
      at(closed + 0.12 + 0.42 + (BLOCKS - 1) * STAGGER + 0.04, finish);
    },
    [play, at, shake, finish],
  );

  // ---- the sequence ------------------------------------------------------

  const runSequence = useCallback(
    (calm) => {
      // 1. Tension, then each panel slams into place on its hit.
      PIECES.forEach((p, i) => {
        const el = pieceEls.current[p.id];
        const hit = T.hits[i];
        const slamStart = hit - 0.38; // impact lands at 76% of a 0.5 s move
        const frames = [];
        const steps = 16;
        for (let s = 0; s <= steps; s++) {
          const f = s / steps;
          const amp = calm || s === steps ? 0 : 1 + f * 6;
          frames.push({ transform: apart(p, 1 - 0.15 * f, rand(amp), rand(amp)) });
        }
        play(el, frames, 0, slamStart);
        play(
          el,
          calm
            ? [
                { transform: apart(p, 0.85), opacity: 1 },
                { transform: apart(p, 0), opacity: 1 },
              ]
            : [
                { offset: 0, transform: apart(p, 0.85), filter: 'blur(0px)', easing: 'cubic-bezier(.2,.7,.3,1)' },
                { offset: 0.42, transform: apart(p, 1.3, 0, 0, 1.08), filter: 'blur(0px)', easing: 'cubic-bezier(.8,0,.9,.5)' },
                { offset: 0.62, transform: apart(p, 0.45, 0, 0, 1.03), filter: 'blur(5px)' },
                { offset: 0.76, transform: apart(p, 0, 0, 0, 1.07, 0.93), filter: 'blur(0px)', easing: 'cubic-bezier(.3,1.6,.5,1)' },
                { offset: 1, transform: apart(p, 0), filter: 'blur(0px)' },
              ],
          slamStart,
          0.5,
        );
        at(hit, () => {
          energy.current = 1;
          el?.classList.add('locked');
          if (!calm) {
            burst(p);
            shake(stage.current, 12, 230);
            flashOnce(0.22, 160);
          }
        });
      });

      // 2. Snare roll: the finished crest shivers harder and harder.
      if (!calm) {
        const frames = [];
        const steps = 18;
        for (let s = 0; s <= steps; s++) {
          const f = s / steps;
          const amp = s === steps ? 0 : 1 + f * 7;
          frames.push({ transform: `translate(${rand(amp)}px, ${rand(amp)}px) scale(${1 + 0.07 * f})` });
        }
        play(crestFx.current, frames, T.roll, T.drop - T.roll, { fill: 'none' });
      }

      // 3. The drop.
      play(crestFx.current, [{ transform: 'scale(1.22)' }, { transform: 'scale(1)' }], T.drop, 0.45, {
        easing: 'cubic-bezier(.2,1.5,.4,1)',
        fill: 'none',
      });
      if (!calm) {
        play(
          crestFx.current,
          [
            { filter: 'drop-shadow(12px 0 0 rgba(255,30,70,.9)) drop-shadow(-12px 0 0 rgba(0,230,255,.9))' },
            { filter: 'drop-shadow(0px 0 0 rgba(255,30,70,0)) drop-shadow(0px 0 0 rgba(0,230,255,0))' },
          ],
          T.drop,
          0.65,
          { easing: 'ease-out', fill: 'none' },
        );
        shocks.current.forEach((s, i) =>
          play(
            s,
            [
              { transform: 'translate(-50%, -50%) scale(.6) rotate(0deg)', opacity: 1 },
              { transform: `translate(-50%, -50%) scale(${3.4 - i * 0.8}) rotate(${45 + i * 45}deg)`, opacity: 0 },
            ],
            T.drop + i * 0.09,
            0.75,
            { easing: 'cubic-bezier(.1,.7,.3,1)', fill: 'none' },
          ),
        );
      }
      at(T.drop, () => {
        energy.current = 1.3;
        root.current?.classList.add('dropped');
        if (!calm) {
          flashOnce(0.85, 420);
          shake(stage.current, 20, 340);
        }
      });

      // 4. The beat: the crest pumps on every kick, glitches on the snares.
      KICKS.forEach((k) => {
        play(crestFx.current, [{ transform: 'scale(1.055)' }, { transform: 'scale(1)' }], k, 0.24, { easing: 'ease-out', fill: 'none' });
        at(k, () => {
          energy.current = 1;
        });
      });
      if (!calm) {
        SNARES.forEach((n) => {
          play(
            crestFx.current,
            [
              { filter: 'drop-shadow(5px 0 0 rgba(255,30,70,.8)) drop-shadow(-5px 0 0 rgba(0,230,255,.8))' },
              { filter: 'drop-shadow(0px 0 0 rgba(255,30,70,0)) drop-shadow(0px 0 0 rgba(0,230,255,0))' },
            ],
            n,
            0.16,
            { fill: 'none' },
          );
          if (n > T.bell) {
            play(
              nameInner.current,
              [
                { transform: 'translateX(-7px) skewX(-14deg)', filter: 'drop-shadow(4px 0 0 rgba(255,30,70,.8))' },
                { transform: 'translateX(4px) skewX(8deg)', filter: 'drop-shadow(-4px 0 0 rgba(0,230,255,.8))' },
                { transform: 'translateX(0px) skewX(0deg)', filter: 'drop-shadow(0px 0 0 rgba(0,0,0,0))' },
              ],
              n,
              0.14,
              { fill: 'none' },
            );
          }
        });
      }

      // 5. Make room for the name.
      const shift = ((nameEl.current?.offsetHeight ?? 120) + 24) / 2;
      play(group.current, [{ transform: 'translateY(0px)' }, { transform: `translateY(${-shift}px)` }], T.lift, 0.55, {
        easing: 'cubic-bezier(.2,.9,.2,1)',
      });
      play(crestPos.current, [{ transform: 'scale(1)' }, { transform: 'scale(.8)' }], T.lift, 0.55, {
        easing: 'cubic-bezier(.2,.9,.2,1)',
      });
      at(T.lift + 0.2, () => nameEl.current?.classList.add('on'));

      // 6. Typewriter.
      [...NAME].forEach((ch, i) => {
        const time = T.typeStart + i * T.typeStep;
        play(
          letterEls.current[i],
          [
            { opacity: 0, transform: 'translateY(-20px) scale(1.4) rotate(0deg)' },
            { opacity: 1, transform: `translateY(${rand(2.5)}px) scale(1) rotate(${rand(2.5)}deg)` },
          ],
          time,
          0.09,
          { easing: 'cubic-bezier(.2,.9,.3,1.3)' },
        );
        at(time, () => {
          const l = letterEls.current[i];
          if (l && cursor.current) cursor.current.style.transform = `translateX(${l.offsetLeft + l.offsetWidth + 6}px)`;
          if (ch !== ' ') shake(nameInner.current, 3, 90);
        });
      });
      play(underline.current, [{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], T.bell, 0.34, {
        easing: 'cubic-bezier(.7,0,.2,1)',
      });
      at(T.bell, () => cursor.current?.classList.add('blink'));

      // 7. Out on the final hit.
      at(T.final - COVER - (BLOCKS - 1) * STAGGER, () => {
        leaving.current = true;
      });
      runExit(T.final - COVER - (BLOCKS - 1) * STAGGER);
    },
    [play, at, burst, shake, flashOnce, runExit],
  );

  // ---- controls -----------------------------------------------------------

  const start = useCallback(() => {
    if (phaseRef.current !== 'gate') return;
    goPhase('playing');
    const calm = prefersCalm();
    const eng = createSoundEngine();
    engine.current = eng;
    let latency = 0;
    if (eng) {
      eng.ctx.resume?.();
      eng.setMuted(mutedRef.current);
      latency = (eng.ctx.outputLatency || eng.ctx.baseLatency || 0) * 1000;
      playScore(eng, eng.ctx.currentTime + 0.1);
    }
    t0.current = performance.now() + 100 + latency;
    document.fonts?.load?.('1em "Special Elite"');
    runSequence(calm);
  }, [runSequence]);

  const skip = useCallback(() => {
    if (leaving.current) return;
    leaving.current = true;
    timers.current.forEach(clearTimeout);
    timers.current = [];
    const now = performance.now();
    // Drop everything that has not started yet; let running motion finish.
    anims.current.forEach((a) => {
      if (a.startTime !== null && a.startTime > now) a.cancel();
    });
    engine.current?.fadeOut(0.35);
    if (!t0.current) t0.current = now;
    goPhase(phaseRef.current === 'gate' ? 'skipping' : phaseRef.current);
    runExit((now - t0.current) / 1000 + 0.02);
  }, [runExit]);

  const toggleMute = useCallback(() => {
    mutedRef.current = !mutedRef.current;
    setMuted(mutedRef.current);
    engine.current?.setMuted(mutedRef.current);
  }, []);

  // ---- lifecycle ----------------------------------------------------------

  const keys = useRef({});
  keys.current = { skip, start, toggleMute };
  useEffect(() => {
    // The boot loader has the same dark screen, so swapping it out is seamless.
    document.getElementById('boot')?.remove();
    document.body.classList.add('intro-open');
    const onKey = (e) => {
      if (e.key === 'Escape') keys.current.skip();
      else if (e.key === 'Enter' && phaseRef.current === 'gate') {
        e.preventDefault();
        keys.current.start();
      } else if (e.key === 'm' || e.key === 'M') keys.current.toggleMute();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.classList.remove('intro-open');
      timers.current.forEach(clearTimeout);
    };
  }, []);

  // Audio-reactive bars + timecode, every frame.
  useEffect(() => {
    const canvas = viz.current;
    const g = canvas.getContext('2d');
    const bars = 48;
    const peaks = new Float32Array(bars);
    const bins = new Uint8Array(64);
    let w = 0;
    let h = 0;
    let dpr = 1;
    let raf = 0;
    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = canvas.width = Math.floor(canvas.clientWidth * dpr);
      h = canvas.height = Math.floor(canvas.clientHeight * dpr);
    };
    const draw = (now) => {
      raf = requestAnimationFrame(draw);
      if (timecode.current) {
        const sec = t0.current ? Math.max(0, (now - t0.current) / 1000) : 0;
        const ff = String(Math.floor((sec % 1) * 30)).padStart(2, '0');
        timecode.current.textContent = `00:00:${String(Math.floor(sec)).padStart(2, '0')}:${ff}`;
      }
      g.clearRect(0, 0, w, h);
      const analyser = engine.current?.analyser;
      const live = analyser && t0.current && !engine.current.ctx.state.startsWith('c');
      if (live) analyser.getByteFrequencyData(bins);
      energy.current *= 0.9;
      const gap = 3 * dpr;
      const bw = (w - gap * (bars - 1)) / bars;
      for (let i = 0; i < bars; i++) {
        let v = live
          ? bins[Math.min(63, 1 + Math.floor(i * 1.2))] / 255
          : 0.05 + 0.035 * Math.sin(now / 380 + i * 0.55) + energy.current * (0.45 + 0.45 * Math.sin(i * 1.7 + now / 80));
        v = Math.max(0, Math.min(1, v));
        peaks[i] = Math.max(peaks[i] - 0.01, v);
        const x = i * (bw + gap);
        const bh = Math.max(2 * dpr, v * h);
        g.fillStyle = '#ff6b1a';
        g.fillRect(x, h - bh, bw, bh);
        g.fillStyle = 'rgba(255,255,255,.9)';
        g.fillRect(x, h - peaks[i] * h - 4 * dpr, bw, 2 * dpr);
      }
    };
    resize();
    window.addEventListener('resize', resize);
    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, []);

  const marquee = 'MAX TC /// '.repeat(10);

  return (
    <div ref={root} className={`intro is-${phase}`} role="dialog" aria-modal="true" aria-label={`${NAME} intro`}>
      <div className="intro-bg" aria-hidden="true" />
      <div className="intro-marquee" aria-hidden="true">
        <div className="row">
          <span>{marquee}</span>
          <span>{marquee}</span>
        </div>
        <div className="row reverse">
          <span>{marquee}</span>
          <span>{marquee}</span>
        </div>
      </div>
      <canvas className="intro-viz" ref={viz} aria-hidden="true" />

      <div className="intro-stage" ref={stage}>
        <div className="intro-group" ref={group}>
          <div className="intro-crest-pos" ref={crestPos}>
            <div className="intro-crest" ref={crestFx}>
              {PIECES.map((p, i) => (
                <span
                  key={p.id}
                  ref={(el) => {
                    pieceEls.current[p.id] = el;
                  }}
                  className={`crest-piece crest-${p.id}`}
                  style={pieceStyle(p, i)}
                >
                  <img src={p.src} alt="" draggable="false" />
                </span>
              ))}
            </div>
            <span className="intro-shock" ref={(el) => (shocks.current[0] = el)} />
            <span className="intro-shock alt" ref={(el) => (shocks.current[1] = el)} />
          </div>
          <div className="intro-name" ref={nameEl}>
            <div className="intro-name-inner" ref={nameInner}>
              {[...NAME].map((ch, i) => (
                <span key={i} ref={(el) => (letterEls.current[i] = el)} className="intro-letter">
                  {ch === ' ' ? ' ' : ch}
                </span>
              ))}
              <span className="intro-cursor" ref={cursor} />
            </div>
            <span className="intro-underline" ref={underline} />
          </div>
        </div>
      </div>

      <div className="intro-particles" ref={particles} aria-hidden="true" />
      <div className="intro-scan" aria-hidden="true" />
      <div className="intro-flash" ref={flash} aria-hidden="true" />

      <div className="intro-hud">
        <span className="hud-corner tl" />
        <span className="hud-corner tr" />
        <span className="hud-corner bl" />
        <span className="hud-corner br" />
        <div className="hud-label hud-top-left">Northhill</div>
        <div className="hud-label hud-top-right">
          <span className="hud-rec" /> REC <span ref={timecode}>00:00:00:00</span>
        </div>
        <button type="button" className="hud-btn hud-sound" onClick={toggleMute} aria-pressed={!muted}>
          Sound: {muted ? 'off' : 'on'}
        </button>
        <button type="button" className="hud-btn hud-skip" onClick={skip}>
          Skip
        </button>
      </div>

      {phase === 'gate' && (
        <div className="intro-gate">
          {/* eslint-disable-next-line jsx-a11y/no-autofocus */}
          <button type="button" className="intro-enter" onClick={start} autoFocus>
            Enter
          </button>
          <p className="intro-hint">Turn your sound on</p>
        </div>
      )}

      <div className="wipe intro-wipe" aria-hidden="true">
        {Array.from({ length: BLOCKS }, (_, i) => (
          <span key={i} ref={(el) => (blockEls.current[i] = el)} />
        ))}
      </div>
    </div>
  );
}
