// The intro soundtrack. Everything is synthesised live with the Web Audio
// API (no audio files): a riser, three hits as the crest is built, a snare
// roll into the drop, two bars of beat with bass, typewriter keys and the
// carriage-return bell, then a final hit.
//
// The visuals in IntroOverlay.jsx use the same timeline (TIMELINE below), so
// every slam, pulse and letter lands on the beat.

// Creator credit typed out at the end of the intro.
export const CREDIT = 'Max TC';

const BEAT = 0.5; // 120 BPM

export const TIMELINE = {
  hits: [1.5, 2.0, 2.5], // red, blue, green panels slam in
  roll: 2.75, // snare roll into the drop
  drop: 3.5,
  lift: 4.05, // crest moves up to make room for the name
  typeStart: 4.5,
  typeStep: 0.125,
  bell: 5.3,
  whoosh: 7.0,
  final: 7.5, // wipe closes on the last hit
  reveal: 7.62,
  done: 8.35,
};

// Beats after the drop (bar 1 and 2) plus two syncopated kicks.
export const KICKS = [4.0, 4.5, 5.0, 5.5, 6.0, 6.5, 7.0, 4.75, 6.75];
export const SNARES = [4.0, 5.0, 6.0, 7.0];

function makeNoise(ctx, seconds) {
  const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}

function makeImpulse(ctx, seconds, decay) {
  const length = Math.floor(ctx.sampleRate * seconds);
  const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const data = buffer.getChannelData(c);
    for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length) ** decay;
  }
  return buffer;
}

function makeDrive(ctx, amount) {
  const shaper = ctx.createWaveShaper();
  const n = 1024;
  const curve = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    curve[i] = Math.tanh(amount * x) / Math.tanh(amount);
  }
  shaper.curve = curve;
  shaper.oversample = '2x';
  return shaper;
}

export function createSoundEngine(existing) {
  let ctx = existing;
  if (!ctx) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;
    try {
      ctx = new AudioCtx({ latencyHint: 'interactive' });
    } catch {
      return null;
    }
  }

  // sources -> bus -> compressor -> master (fades) -> analyser -> output (mute)
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -16;
  comp.knee.value = 10;
  comp.ratio.value = 5;
  comp.attack.value = 0.002;
  comp.release.value = 0.12;
  const master = ctx.createGain();
  master.gain.value = 0.9;
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 128;
  analyser.smoothingTimeConstant = 0.72;
  const output = ctx.createGain();
  comp.connect(master);
  master.connect(analyser);
  analyser.connect(output);
  output.connect(ctx.destination);

  const bus = ctx.createGain();
  bus.connect(comp);
  const reverb = ctx.createConvolver();
  reverb.buffer = makeImpulse(ctx, 2.4, 2.8);
  const verb = ctx.createGain();
  verb.gain.value = 0.3;
  verb.connect(reverb);
  reverb.connect(comp);
  const drive = makeDrive(ctx, 2.6);
  drive.connect(bus);

  const noise = makeNoise(ctx, 2);

  function envelope(param, t, peak, attack, release) {
    param.setValueAtTime(0.0001, t);
    param.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t + attack);
    param.exponentialRampToValueAtTime(0.0001, t + attack + release);
  }

  function connectAll(node, dests) {
    for (const d of dests) node.connect(d);
  }

  function tone(type, freq, t, { gain = 0.3, attack = 0.004, release = 0.2, glideTo, glideTime, dests = [bus], detune = 0 } = {}) {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (glideTo) o.frequency.exponentialRampToValueAtTime(glideTo, t + (glideTime ?? release));
    o.detune.value = detune;
    const g = ctx.createGain();
    envelope(g.gain, t, gain, attack, release);
    o.connect(g);
    connectAll(g, dests);
    o.start(t);
    o.stop(t + attack + release + 0.05);
  }

  function hiss(t, { dur = 0.2, gain = 0.4, type = 'highpass', freq = 1000, q = 0.7, sweepTo, attack = 0.002, dests = [bus] } = {}) {
    const s = ctx.createBufferSource();
    s.buffer = noise;
    s.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.Q.value = q;
    f.frequency.setValueAtTime(freq, t);
    if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
    const g = ctx.createGain();
    envelope(g.gain, t, gain, attack, dur);
    s.connect(f);
    f.connect(g);
    connectAll(g, dests);
    s.start(t, Math.random() * 1.5);
    s.stop(t + attack + dur + 0.05);
  }

  const inst = {
    kick(t, v = 1) {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(175, t);
      o.frequency.exponentialRampToValueAtTime(48, t + 0.1);
      o.frequency.exponentialRampToValueAtTime(36, t + 0.42);
      const g = ctx.createGain();
      envelope(g.gain, t, 0.95 * v, 0.003, 0.45);
      o.connect(g);
      g.connect(drive);
      o.start(t);
      o.stop(t + 0.5);
      hiss(t, { dur: 0.02, gain: 0.3 * v, freq: 3500 });
    },
    snare(t, v = 1) {
      hiss(t, { dur: 0.2, gain: 0.5 * v, type: 'bandpass', freq: 1900, q: 0.8, dests: [bus, verb] });
      tone('triangle', 210, t, { gain: 0.32 * v, release: 0.1, glideTo: 140 });
    },
    hat(t, v = 1, open = false) {
      hiss(t, { dur: open ? 0.22 : 0.04, gain: 0.16 * v, freq: 8000 });
    },
    bass(t, freq, dur, v = 1) {
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.Q.value = 7;
      f.frequency.setValueAtTime(1500, t);
      f.frequency.exponentialRampToValueAtTime(230, t + dur);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.3 * v, t + 0.006);
      g.gain.setValueAtTime(0.3 * v, t + dur * 0.7);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      f.connect(g);
      g.connect(drive);
      for (const [type, detune] of [['sawtooth', -14], ['sawtooth', 14], ['sine', 0]]) {
        const o = ctx.createOscillator();
        o.type = type;
        o.frequency.setValueAtTime(freq, t);
        o.detune.value = detune;
        o.connect(f);
        o.start(t);
        o.stop(t + dur + 0.05);
      }
    },
    stab(t, freqs, v = 1, dur = 0.35) {
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.setValueAtTime(4200, t);
      f.frequency.exponentialRampToValueAtTime(700, t + dur);
      const g = ctx.createGain();
      envelope(g.gain, t, 0.16 * v, 0.004, dur);
      f.connect(g);
      connectAll(g, [bus, verb]);
      for (const fr of freqs) {
        for (const [type, detune] of [['sawtooth', -8], ['square', 8]]) {
          const o = ctx.createOscillator();
          o.type = type;
          o.frequency.value = fr;
          o.detune.value = detune;
          o.connect(f);
          o.start(t);
          o.stop(t + dur + 0.05);
        }
      }
    },
    riser(t, dur, v = 1) {
      const n = ctx.createBufferSource();
      n.buffer = noise;
      n.loop = true;
      const nf = ctx.createBiquadFilter();
      nf.type = 'bandpass';
      nf.Q.value = 3;
      nf.frequency.setValueAtTime(350, t);
      nf.frequency.exponentialRampToValueAtTime(9000, t + dur);
      const ng = ctx.createGain();
      ng.gain.setValueAtTime(0.0001, t);
      ng.gain.exponentialRampToValueAtTime(0.48 * v, t + dur);
      ng.gain.setValueAtTime(0.0001, t + dur + 0.01);
      n.connect(nf);
      nf.connect(ng);
      ng.connect(bus);
      n.start(t);
      n.stop(t + dur + 0.05);

      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.setValueAtTime(900, t);
      f.frequency.exponentialRampToValueAtTime(6000, t + dur);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.09 * v, t + dur);
      g.gain.setValueAtTime(0.0001, t + dur + 0.01);
      f.connect(g);
      g.connect(bus);
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(90, t);
      o.frequency.exponentialRampToValueAtTime(880, t + dur);
      o.connect(f);
      o.start(t);
      o.stop(t + dur + 0.05);
    },
    // Low, detuned bass that opens up over `dur` and cuts dead at the end.
    drone(t, dur, v = 1) {
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.Q.value = 4;
      f.frequency.setValueAtTime(110, t);
      f.frequency.exponentialRampToValueAtTime(2200, t + dur);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.14 * v, t + dur * 0.85);
      g.gain.setValueAtTime(0.14 * v, t + dur - 0.02);
      g.gain.linearRampToValueAtTime(0.0001, t + dur);
      f.connect(g);
      g.connect(drive);
      for (const [type, freq, detune] of [['sawtooth', 55, -10], ['sawtooth', 55, 10], ['square', 27.5, 0]]) {
        const o = ctx.createOscillator();
        o.type = type;
        o.frequency.value = freq;
        o.detune.value = detune;
        o.connect(f);
        o.start(t);
        o.stop(t + dur + 0.05);
      }
    },
    impact(t, v = 1) {
      tone('sine', 95, t, { gain: 0.9 * v, attack: 0.003, release: 1.7, glideTo: 30, glideTime: 1.2 });
      hiss(t, { dur: 0.9, gain: 0.55 * v, type: 'lowpass', freq: 1400, sweepTo: 200, dests: [bus, verb] });
      hiss(t, { dur: 1.6, gain: 0.2 * v, freq: 4500, dests: [bus, verb] });
    },
    typeKey(t, v = 1) {
      hiss(t, { dur: 0.035, gain: 0.55 * v, type: 'bandpass', freq: 3200, q: 2.5 });
      tone('square', 1500, t, { gain: 0.05 * v, release: 0.012 });
      tone('sine', 150, t, { gain: 0.4 * v, release: 0.06, glideTo: 90 });
    },
    spaceBar(t) {
      tone('sine', 95, t, { gain: 0.45, release: 0.09, glideTo: 60 });
      hiss(t, { dur: 0.05, gain: 0.25, type: 'lowpass', freq: 1300 });
    },
    bell(t) {
      tone('sine', 2093, t, { gain: 0.2, attack: 0.002, release: 1.4, dests: [bus, verb] });
      tone('sine', 3140, t, { gain: 0.08, attack: 0.002, release: 0.9, dests: [bus, verb] });
      tone('sine', 4186, t, { gain: 0.04, attack: 0.002, release: 0.5 });
    },
    whoosh(t, dur) {
      const s = ctx.createBufferSource();
      s.buffer = noise;
      s.loop = true;
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.setValueAtTime(300, t);
      f.frequency.exponentialRampToValueAtTime(7000, t + dur);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.5, t + dur);
      g.gain.setValueAtTime(0.0001, t + dur + 0.005);
      s.connect(f);
      f.connect(g);
      g.connect(bus);
      s.start(t);
      s.stop(t + dur + 0.05);
    },
  };

  let closed = false;
  return {
    ctx,
    analyser,
    inst,
    setMuted(muted) {
      output.gain.setTargetAtTime(muted ? 0 : 1, ctx.currentTime, 0.02);
    },
    fadeOut(seconds = 0.3) {
      const now = ctx.currentTime;
      master.gain.cancelScheduledValues(now);
      master.gain.setValueAtTime(master.gain.value, now);
      master.gain.linearRampToValueAtTime(0, now + seconds);
    },
    close() {
      if (closed || !ctx.close) return;
      closed = true;
      ctx.close().catch(() => {});
    },
  };
}

// Schedules the whole track, starting at audio-clock time `s`.
export function playScore(engine, s) {
  const { kick, snare, hat, bass, stab, riser, drone, impact, typeKey, spaceBar, bell, whoosh } = engine.inst;
  const T = TIMELINE;

  // Tension: riser, a growing drone and a hi-hat tick that speeds up.
  riser(s, T.hits[0]);
  drone(s, T.drop);
  for (let i = 0; i < 4; i++) hat(s + 0.5 + i * 0.25, 0.35 + i * 0.1);
  for (let i = 0; i < 4; i++) hat(s + 1.0 + i * 0.125, 0.6 + i * 0.1);

  // Three hits, one per panel, on a rising A-minor arpeggio.
  const arp = [110, 130.81, 164.81];
  T.hits.forEach((h, i) => {
    kick(s + h, 1);
    stab(s + h, [arp[i], arp[i] * 2], 0.9, 0.3);
    hat(s + h, 0.8, true);
  });

  // Snare roll into the drop.
  const roll = [2.75, 3.0, 3.125, 3.25, 3.3125, 3.375, 3.4375];
  roll.forEach((r, i) => snare(s + r, 0.55 + (i / roll.length) * 0.65));
  riser(s + T.hits[2], T.drop - T.hits[2], 0.8);

  // Drop.
  impact(s + T.drop, 1);
  kick(s + T.drop, 1.1);
  stab(s + T.drop, [220, 261.63, 329.63, 440], 1, 0.7);

  // Two bars of beat.
  KICKS.forEach((k) => kick(s + k, 0.95));
  SNARES.forEach((n) => snare(s + n, 0.85));
  for (let t = T.drop; t < T.final; t += BEAT / 2) {
    const offbeat = Math.round((t - T.drop) / (BEAT / 2)) % 2 === 1;
    hat(s + t, offbeat ? 0.7 : 0.3, offbeat && Math.round((t - T.drop) / BEAT) % 4 === 3);
  }
  const roots = [55, 55, 65.41, 49, 43.65, 43.65, 49, 41.2]; // A A C G F F G E
  roots.forEach((root, i) => {
    const b = T.drop + i * BEAT;
    bass(s + b, root, 0.22);
    bass(s + b + BEAT / 2, root * 2, 0.17, 0.7);
  });

  // Typewriter: one key per letter, then the bell.
  [...CREDIT].forEach((ch, i) => {
    const t = s + T.typeStart + i * T.typeStep;
    if (ch === ' ') spaceBar(t);
    else typeKey(t, 1);
  });
  bell(s + T.bell);

  // Out.
  whoosh(s + T.whoosh, T.final - T.whoosh);
  impact(s + T.final, 1.1);
  kick(s + T.final, 1.1);
  stab(s + T.final, [110, 220, 261.63, 329.63], 1, 1.3);
}
