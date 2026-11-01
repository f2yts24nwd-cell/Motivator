// Epic, fully synthesized audio engine (no audio files -> works offline as PWA).
// Orchestral-style instruments (taiko, strings, brass, choir, risers, "braaam" impacts)
// running through a generated concert-hall reverb, plus a lookahead music sequencer.

let ctx = null;
let master, comp, musicBus, sfxBus, reverb, reverbSend;
let muted = false;
let unlocked = false;
try { muted = localStorage.getItem('sw-muted') === '1'; } catch { /* ignore */ }

const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
const rnd = (a, b) => a + Math.random() * (b - a);

function makeImpulse(seconds, decay) {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) {
      const t = i / len;
      // early reflections in the first 60 ms, then a dense, darkening tail
      const early = i < ctx.sampleRate * 0.06 && Math.random() < 0.02 ? 0.8 : 0;
      d[i] = ((Math.random() * 2 - 1) * 0.6 + early) * Math.pow(1 - t, decay);
    }
  }
  return buf;
}

function ac() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.9;
    comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.knee.value = 10;
    comp.ratio.value = 4;
    comp.attack.value = 0.005;
    comp.release.value = 0.2;
    master.connect(comp).connect(ctx.destination);
    musicBus = ctx.createGain();
    musicBus.gain.value = 0.55;
    sfxBus = ctx.createGain();
    sfxBus.gain.value = 0.9;
    musicBus.connect(master);
    sfxBus.connect(master);
    reverb = ctx.createConvolver();
    reverb.buffer = makeImpulse(3.2, 3.2);
    const ret = ctx.createGain();
    ret.gain.value = 0.42;
    const verbTone = ctx.createBiquadFilter();
    verbTone.type = 'lowpass';
    verbTone.frequency.value = 5200;
    reverbSend = ctx.createGain();
    reverbSend.connect(reverb).connect(verbTone).connect(ret).connect(master);
  }
  if (ctx.state === 'suspended' && unlocked) ctx.resume();
  return ctx;
}

export function unlockAudio() {
  if (!ac()) return;
  if (ctx.state === 'suspended') ctx.resume();
  // iOS Safari only starts WebAudio after a sound was played inside a user gesture
  if (!unlocked) {
    const b = ctx.createBuffer(1, 1, 22050);
    const s = ctx.createBufferSource();
    s.buffer = b;
    s.connect(ctx.destination);
    s.start(0);
    unlocked = true;
    music.kick();
  }
}
export function suspendAudio() { if (ctx && ctx.state === 'running') ctx.suspend(); }
export function isMuted() { return muted; }
export function setMuted(m) {
  muted = m;
  try { localStorage.setItem('sw-muted', m ? '1' : '0'); } catch { /* ignore */ }
  if (master) master.gain.setTargetAtTime(m ? 0 : 0.9, ctx.currentTime, 0.05);
}
const ready = () => ac() && ctx.state === 'running';

// ------------------------------------------------------------------ building blocks
let noiseBuf = null;
function noise() {
  if (!noiseBuf) {
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const s = ctx.createBufferSource();
  s.buffer = noiseBuf;
  s.loop = true;
  return s;
}

/** Output node with optional pan + reverb send. */
function out(bus, { pan = 0, wet = 0.25 } = {}) {
  const g = ctx.createGain();
  let node = g;
  if (pan && ctx.createStereoPanner) {
    const p = ctx.createStereoPanner();
    p.pan.value = Math.max(-1, Math.min(1, pan));
    g.connect(p);
    node = p;
  }
  node.connect(bus);
  if (wet > 0) {
    const s = ctx.createGain();
    s.gain.value = wet;
    node.connect(s).connect(reverbSend);
  }
  return g;
}

function adsr(param, t, { a = 0.01, d = 0.1, s = 0.7, r = 0.2, peak = 1, dur = 0.3 }) {
  param.cancelScheduledValues(t);
  param.setValueAtTime(0.0001, t);
  param.linearRampToValueAtTime(peak, t + a);
  param.setTargetAtTime(peak * s, t + a, d / 3);
  param.setValueAtTime(peak * s, t + Math.max(a, dur));
  param.setTargetAtTime(0.0001, t + Math.max(a, dur), r / 4);
}

function osc(type, freq, t, stop, detune = 0) {
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  o.detune.value = detune;
  o.start(t);
  o.stop(stop);
  return o;
}

// ------------------------------------------------------------------ instruments
const inst = {
  taiko(bus, t, vel = 1, pan = 0, pitch = 1) {
    const dest = out(bus, { pan, wet: 0.35 });
    // drum body
    const o = osc('sine', 110 * pitch, t, t + 1.2);
    o.frequency.exponentialRampToValueAtTime(48 * pitch, t + 0.25);
    const g = ctx.createGain();
    adsr(g.gain, t, { a: 0.002, d: 0.5, s: 0.0001, r: 0.3, peak: 0.9 * vel, dur: 0.01 });
    o.connect(g).connect(dest);
    // skin slap
    const n = noise();
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(1800, t);
    f.frequency.exponentialRampToValueAtTime(200, t + 0.15);
    const ng = ctx.createGain();
    adsr(ng.gain, t, { a: 0.001, d: 0.12, s: 0.0001, r: 0.05, peak: 0.5 * vel, dur: 0.005 });
    n.connect(f).connect(ng).connect(dest);
    n.start(t, Math.random()); n.stop(t + 0.4);
  },
  snare(bus, t, vel = 1, pan = 0.15) {
    const dest = out(bus, { pan, wet: 0.4 });
    const n = noise();
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass'; f.frequency.value = 1900; f.Q.value = 0.8;
    const g = ctx.createGain();
    adsr(g.gain, t, { a: 0.001, d: 0.18, s: 0.0001, r: 0.1, peak: 0.35 * vel, dur: 0.005 });
    n.connect(f).connect(g).connect(dest);
    n.start(t, Math.random()); n.stop(t + 0.4);
    const o = osc('triangle', 220, t, t + 0.2);
    o.frequency.exponentialRampToValueAtTime(120, t + 0.1);
    const og = ctx.createGain();
    adsr(og.gain, t, { a: 0.001, d: 0.08, s: 0.0001, r: 0.05, peak: 0.25 * vel, dur: 0.005 });
    o.connect(og).connect(dest);
  },
  /** sawtooth ensemble voice (strings / low brass core) */
  ens(bus, t, midi, dur, { vol = 0.05, cutoff = 1800, a = 0.02, r = 0.25, voices = 2, spread = 8, pan = 0, wet = 0.35, type = 'sawtooth', filterEnv = 0 } = {}) {
    const dest = out(bus, { pan, wet });
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.Q.value = 0.6;
    if (filterEnv) {
      f.frequency.setValueAtTime(cutoff * 0.25, t);
      f.frequency.exponentialRampToValueAtTime(cutoff * filterEnv, t + Math.min(0.08, dur));
      f.frequency.setTargetAtTime(cutoff, t + 0.08, 0.15);
    } else f.frequency.value = cutoff;
    const g = ctx.createGain();
    adsr(g.gain, t, { a, d: 0.2, s: 0.8, r, peak: vol, dur });
    f.connect(g).connect(dest);
    const stop = t + dur + r + 0.1;
    for (let v = 0; v < voices; v++) {
      const det = voices === 1 ? 0 : (v / (voices - 1) - 0.5) * 2 * spread;
      const o = osc(type, mtof(midi), t, stop, det + rnd(-2, 2));
      o.connect(f);
    }
  },
  /** choir "aah" with formant filters */
  choir(bus, t, midi, dur, vol = 0.045, pan = 0) {
    const dest = out(bus, { pan, wet: 0.6 });
    const g = ctx.createGain();
    adsr(g.gain, t, { a: 0.6, d: 0.3, s: 0.9, r: 0.9, peak: vol, dur });
    g.connect(dest);
    const stop = t + dur + 1.2;
    const src = ctx.createGain();
    for (const det of [-9, 0, 9]) {
      const o = osc('sawtooth', mtof(midi), t, stop, det);
      const lfo = osc('sine', rnd(4.5, 5.5), t, stop);
      const lg = ctx.createGain(); lg.gain.value = 9;
      lfo.connect(lg).connect(o.detune);
      o.connect(src);
    }
    for (const [fq, q, amp] of [[800, 8, 1], [1150, 9, 0.6], [2900, 10, 0.25]]) {
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass'; bp.frequency.value = fq; bp.Q.value = q;
      const ag = ctx.createGain(); ag.gain.value = amp * 3;
      src.connect(bp).connect(ag).connect(g);
    }
  },
  /** cinematic "braaam": detuned brass cluster + sub, filter swell */
  braam(bus, t, midis, dur = 2.5, vol = 0.12) {
    const dest = out(bus, { wet: 0.5 });
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(180, t);
    f.frequency.exponentialRampToValueAtTime(1600, t + 0.18);
    f.frequency.setTargetAtTime(380, t + 0.25, dur / 3);
    const shaper = ctx.createWaveShaper();
    const curve = new Float32Array(256);
    for (let i = 0; i < 256; i++) { const x = i / 128 - 1; curve[i] = Math.tanh(x * 2.5); }
    shaper.curve = curve;
    const g = ctx.createGain();
    adsr(g.gain, t, { a: 0.03, d: dur * 0.6, s: 0.4, r: 0.8, peak: vol, dur });
    f.connect(shaper).connect(g).connect(dest);
    for (const m of midis) for (const det of [-14, 0, 14]) osc('sawtooth', mtof(m), t, t + dur + 1.5, det).connect(f);
    // sub drop
    const sub = osc('sine', 55, t, t + dur + 1);
    sub.frequency.exponentialRampToValueAtTime(32, t + dur);
    const sg = ctx.createGain();
    adsr(sg.gain, t, { a: 0.01, d: dur, s: 0.0001, r: 0.5, peak: vol * 4, dur: 0.05 });
    sub.connect(sg).connect(dest);
  },
  /** noise riser / reverse cymbal */
  swell(bus, t, dur, vol = 0.12, from = 800, to = 9000) {
    const dest = out(bus, { wet: 0.5 });
    const n = noise();
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass'; f.Q.value = 1.2;
    f.frequency.setValueAtTime(from, t);
    f.frequency.exponentialRampToValueAtTime(to, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + dur);
    g.gain.setTargetAtTime(0.0001, t + dur, 0.03);
    n.connect(f).connect(g).connect(dest);
    n.start(t, Math.random()); n.stop(t + dur + 0.3);
  },
  crash(bus, t, vol = 0.12) {
    const dest = out(bus, { wet: 0.6 });
    const n = noise();
    const f = ctx.createBiquadFilter();
    f.type = 'highpass'; f.frequency.value = 4500;
    const g = ctx.createGain();
    adsr(g.gain, t, { a: 0.002, d: 1.8, s: 0.0001, r: 0.5, peak: vol, dur: 0.01 });
    n.connect(f).connect(g).connect(dest);
    n.start(t, Math.random()); n.stop(t + 2.5);
  },
  pluck(bus, t, midi, vol = 0.05, pan = 0) {
    const dest = out(bus, { pan, wet: 0.5 });
    const o = osc('triangle', mtof(midi), t, t + 1.6);
    const o2 = osc('sine', mtof(midi + 12), t, t + 1.6);
    const g = ctx.createGain();
    adsr(g.gain, t, { a: 0.003, d: 0.9, s: 0.0001, r: 0.4, peak: vol, dur: 0.01 });
    const g2 = ctx.createGain(); g2.gain.value = 0.3;
    o.connect(g); o2.connect(g2).connect(g);
    g.connect(dest);
  }
};

// ------------------------------------------------------------------ music themes
// D minor heroic progression i–VI–VII–V and friends; chords as midi roots + quality.
const CH = {
  Dm: [38, [0, 3, 7]], Bb: [34, [0, 4, 7]], C: [36, [0, 4, 7]], A: [33, [0, 4, 7]], F: [41, [0, 4, 7]],
  Gm: [43, [0, 3, 7]], D: [38, [0, 4, 7]], G: [43, [0, 4, 7]], Bm: [35, [0, 3, 7]], Em: [40, [0, 3, 7]]
};
const tones = (name, oct = 0) => { const [r, q] = CH[name]; return q.map((i) => r + i + oct); };

const THEMES = {
  hub: {
    bpm: 84,
    prog: ['Dm', 'Bb', 'F', 'C', 'Dm', 'Bb', 'Gm', 'A'],
    step(bus, s, t, sd, bar, intensity) {
      const ch = this.prog[bar % this.prog.length];
      const T = tones(ch, 24);
      if (s === 0) {
        for (const m of T) inst.ens(bus, t, m, sd * 15, { vol: 0.022, cutoff: 1300, a: 0.7, r: 1.2, voices: 2, wet: 0.55 });
        inst.ens(bus, t, CH[ch][0] + 12, sd * 15, { vol: 0.05, cutoff: 500, a: 0.3, r: 0.8, voices: 2, wet: 0.3 });
        if (bar % 4 === 0) inst.taiko(bus, t, 0.55, 0, 0.8);
        if (bar % 8 >= 4) inst.choir(bus, t, T[2] + 12, sd * 15, 0.03);
      }
      // gentle arpeggio
      if (s % 2 === 0) {
        const arp = [T[0] + 12, T[1] + 12, T[2] + 12, T[1] + 24];
        inst.pluck(bus, t, arp[(s / 2) % 4], 0.035, ((s / 2) % 4 - 1.5) * 0.3);
      }
      if (s === 8 && bar % 2 === 1) inst.taiko(bus, t, 0.3, -0.3, 1.1);
    }
  },
  game: {
    bpm: 138,
    prog: ['Dm', 'Bb', 'C', 'A', 'Dm', 'Bb', 'Gm', 'A'],
    step(bus, s, t, sd, bar, intensity) {
      const ch = this.prog[bar % this.prog.length];
      const T = tones(ch, 24); // octave 3 region
      const root = CH[ch][0];
      const phraseStart = bar % 4 === 0 && s === 0;
      // ---- string ostinato (16ths)
      const pat = [0, 2, 1, 2, 0, 2, 1, 2, 0, 2, 1, 2, 0, 1, 2, 1];
      const note = T[pat[s]] + (s % 4 === 1 || s % 4 === 3 ? 12 : 0);
      inst.ens(bus, t, note, sd * 0.85, { vol: 0.032 + intensity * 0.006, cutoff: 1500 + intensity * 500, a: 0.008, r: 0.08, voices: 2, spread: 7, pan: s % 2 ? 0.25 : -0.25, wet: 0.25 });
      if (intensity >= 3) inst.ens(bus, t, note + 12, sd * 0.8, { vol: 0.018, cutoff: 3500, a: 0.005, r: 0.06, voices: 2, pan: s % 2 ? -0.4 : 0.4, wet: 0.3 });
      // ---- low strings / bass (8ths, driving)
      if (s % 2 === 0) inst.ens(bus, t, root + (s % 8 === 6 ? 7 : 0), sd * 1.7, { vol: 0.075, cutoff: 700, a: 0.01, r: 0.1, voices: 2, wet: 0.15 });
      // ---- percussion
      const taikoPat = [1, 0, 0, 0, 0, 0, 0.7, 0, 1, 0, 0, 0, 0, 0, 0, 0];
      if (taikoPat[s]) inst.taiko(bus, t, taikoPat[s] * (0.75 + intensity * 0.08), 0);
      if (intensity >= 1 && (s === 10 || s === 14)) inst.taiko(bus, t, 0.5, s === 10 ? -0.4 : 0.4, 1.3);
      if (intensity >= 1 && (s === 4 || s === 12)) inst.snare(bus, t, 0.8);
      if (intensity >= 2 && s % 2 === 1) inst.snare(bus, t, 0.18, s % 4 === 1 ? -0.3 : 0.3);
      // drum fill at the end of every 4-bar phrase
      if (bar % 4 === 3 && s >= 12) inst.taiko(bus, t, 0.45 + (s - 12) * 0.15, (s - 13.5) * 0.3, 1 + (s - 12) * 0.08);
      // ---- brass stabs + pads
      if (s === 0) {
        for (const m of T) inst.ens(bus, t, m, sd * 15, { vol: 0.016, cutoff: 1200, a: 0.3, r: 0.6, voices: 2, wet: 0.45 });
        if (intensity >= 1) for (const m of tones(ch, 12)) inst.ens(bus, t, m, sd * 2.5, { vol: 0.045, cutoff: 1400, a: 0.02, r: 0.25, voices: 2, filterEnv: 2.4, wet: 0.4 });
      }
      if (intensity >= 1 && (s === 6 || s === 10)) for (const m of tones(ch, 12)) inst.ens(bus, t, m, sd * 1.2, { vol: 0.032, cutoff: 1300, a: 0.015, r: 0.2, voices: 2, filterEnv: 2.2, wet: 0.4 });
      // ---- choir from intensity 2
      if (intensity >= 2 && s === 0) for (const m of T) inst.choir(bus, t, m + 12, sd * 15, 0.03);
      // ---- epic phrase accents
      if (phraseStart) {
        inst.crash(bus, t, 0.08 + intensity * 0.02);
        if (intensity >= 2) inst.braam(bus, t, [root, root + 7], 1.6, 0.05);
      }
      if (bar % 4 === 3 && s === 0) inst.swell(bus, t, sd * 16, 0.05 + intensity * 0.02);
    }
  },
  cert: {
    bpm: 72,
    prog: ['D', 'A', 'Bm', 'G', 'D', 'A', 'G', 'A'],
    melody: [[74, 4], [76, 2], [78, 2], [81, 6], [79, 2], [78, 4], [76, 4], [74, 8], [73, 4], [74, 2], [76, 2], [78, 6], [76, 2], [74, 8]],
    step(bus, s, t, sd, bar) {
      const ch = this.prog[bar % this.prog.length];
      const T = tones(ch, 24);
      if (s === 0) {
        for (const m of T) inst.ens(bus, t, m, sd * 15.5, { vol: 0.024, cutoff: 1400, a: 0.6, r: 1.2, voices: 2, wet: 0.6 });
        inst.ens(bus, t, CH[ch][0] + 12, sd * 15.5, { vol: 0.05, cutoff: 450, a: 0.3, r: 1, voices: 2, wet: 0.3 });
        inst.choir(bus, t, T[1] + 12, sd * 15.5, 0.025);
        if (bar % 2 === 0) inst.taiko(bus, t, 0.5, 0, 0.75);
      }
      if (s === 8) inst.taiko(bus, t, 0.25, 0.2, 0.9);
      // heroic horn melody (16th-step grid, loops every 4 bars)
      const pos = (bar % 4) * 16 + s;
      let acc = 0;
      for (const [m, len] of this.melody) {
        if (acc === pos) inst.ens(bus, t, m - 12, sd * len * 0.95, { vol: 0.05, cutoff: 1500, a: 0.06, r: 0.5, voices: 2, filterEnv: 1.6, wet: 0.5, pan: -0.1 });
        acc += len;
        if (acc > 64) break;
      }
    }
  }
};

// ------------------------------------------------------------------ sequencer
export const music = {
  current: null,
  wanted: null,
  intensity: 0,
  gain: null,
  timer: null,
  play(name) {
    this.wanted = name;
    if (!ready()) return; // starts on unlock (iOS)
    if (this.current === name) return;
    this.stop(1.2);
    if (!name) return;
    const th = THEMES[name];
    this.current = name;
    this.gain = ctx.createGain();
    this.gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    this.gain.gain.exponentialRampToValueAtTime(1, ctx.currentTime + 0.6);
    this.gain.connect(musicBus);
    const bus = this.gain;
    const sd = 60 / th.bpm / 4;
    let next = ctx.currentTime + 0.08;
    let step = 0;
    this.timer = setInterval(() => {
      if (ctx.state !== 'running') return;
      if (next < ctx.currentTime - 0.3) next = ctx.currentTime + 0.05; // after a stall, resync
      while (next < ctx.currentTime + 0.18) {
        th.step(bus, step % 16, next, sd, Math.floor(step / 16), this.intensity);
        next += sd;
        step++;
      }
    }, 25);
  },
  stop(fade = 1) {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    if (this.gain && ctx) {
      const g = this.gain;
      g.gain.cancelScheduledValues(ctx.currentTime);
      g.gain.setTargetAtTime(0.0001, ctx.currentTime, fade / 4);
      setTimeout(() => g.disconnect(), fade * 1000 + 600);
    }
    this.gain = null;
    this.current = null;
  },
  setIntensity(i) { this.intensity = i; },
  /** called after the iOS unlock: start what was requested before */
  kick() { const w = this.wanted; this.current = null; if (w) this.play(w); }
};

// ------------------------------------------------------------------ sound effects
const T0 = () => ctx.currentTime + 0.005;

export const sfx = {
  swing(pan = 0) {
    if (!ready()) return;
    inst.swell(sfxBus, T0(), 0.11, 0.18, 500, 4000);
    void pan;
  },
  thud(pan = 0) {
    if (!ready()) return;
    const t = T0();
    inst.taiko(sfxBus, t, 0.45, pan, 1.6);
  },
  smash(pitch = 1, pan = 0) {
    if (!ready()) return;
    const t = T0();
    inst.taiko(sfxBus, t, 1.0, pan, 0.75 * pitch);
    inst.taiko(sfxBus, t + 0.01, 0.6, -pan, 1.4 * pitch);
    // sub impact
    const dest = out(sfxBus, { pan, wet: 0.2 });
    const sub = osc('sine', 70, t, t + 0.7);
    sub.frequency.exponentialRampToValueAtTime(28, t + 0.5);
    const sg = ctx.createGain();
    adsr(sg.gain, t, { a: 0.002, d: 0.45, s: 0.0001, r: 0.2, peak: 0.9, dur: 0.01 });
    sub.connect(sg).connect(dest);
    // crunch / debris
    const n = noise();
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(7000, t);
    f.frequency.exponentialRampToValueAtTime(400, t + 0.35);
    const ng = ctx.createGain();
    adsr(ng.gain, t, { a: 0.001, d: 0.3, s: 0.0001, r: 0.1, peak: 0.45, dur: 0.01 });
    n.connect(f).connect(ng).connect(out(sfxBus, { pan, wet: 0.35 }));
    n.start(t, Math.random()); n.stop(t + 0.6);
    // glassy shards
    for (let i = 0; i < 6; i++) inst.pluck(sfxBus, t + 0.04 + Math.random() * 0.3, 88 + Math.floor(Math.random() * 14), 0.03, rnd(-0.8, 0.8));
  },
  splat(pan = 0) {
    if (!ready()) return;
    const t = T0() + 0.03;
    const n = noise();
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass'; f.Q.value = 4;
    f.frequency.setValueAtTime(1400, t);
    f.frequency.exponentialRampToValueAtTime(250, t + 0.25);
    const g = ctx.createGain();
    adsr(g.gain, t, { a: 0.003, d: 0.22, s: 0.0001, r: 0.1, peak: 0.6, dur: 0.01 });
    n.connect(f).connect(g).connect(out(sfxBus, { pan, wet: 0.3 }));
    n.start(t, Math.random()); n.stop(t + 0.5);
  },
  error() {
    if (!ready()) return;
    const t = T0();
    inst.braam(sfxBus, t, [38, 39, 45], 1.4, 0.14); // dissonant cluster
    inst.taiko(sfxBus, t, 1, 0, 0.6);
    // alarm
    for (let i = 0; i < 3; i++) {
      const dest = out(sfxBus, { wet: 0.3 });
      const o = osc('square', i % 2 ? 622 : 880, t + i * 0.16, t + i * 0.16 + 0.14);
      const g = ctx.createGain();
      adsr(g.gain, t + i * 0.16, { a: 0.005, d: 0.05, s: 0.8, r: 0.03, peak: 0.07, dur: 0.12 });
      o.connect(g).connect(dest);
    }
  },
  combo(level = 2) {
    if (!ready()) return;
    const t = T0();
    const base = 50 + Math.min(level, 5) * 2;
    for (const m of [base, base + 4, base + 7, base + 12]) inst.ens(sfxBus, t, m, 0.35, { vol: 0.06, cutoff: 1800, a: 0.01, r: 0.3, voices: 2, filterEnv: 2.5, wet: 0.5 });
    inst.crash(sfxBus, t, 0.08);
  },
  pop() {
    if (!ready()) return;
    const t = T0();
    const dest = out(sfxBus, { wet: 0.2 });
    const o = osc('sine', 260, t, t + 0.15);
    o.frequency.exponentialRampToValueAtTime(620, t + 0.08);
    const g = ctx.createGain();
    adsr(g.gain, t, { a: 0.003, d: 0.08, s: 0.0001, r: 0.05, peak: 0.12, dur: 0.01 });
    o.connect(g).connect(dest);
  },
  /** countdown hit: 3-2-1 = taiko + boom, final = full orchestra impact */
  beep(final = false) {
    if (!ready()) return;
    const t = T0();
    if (!final) {
      inst.taiko(sfxBus, t, 1, 0, 0.7);
      inst.braam(sfxBus, t, [26], 0.7, 0.05);
      inst.swell(sfxBus, t + 0.1, 0.6, 0.05, 400, 3000);
    } else {
      inst.braam(sfxBus, t, [26, 38, 45, 50], 2.4, 0.11);
      inst.taiko(sfxBus, t, 1, -0.3, 0.6);
      inst.taiko(sfxBus, t, 1, 0.3, 0.9);
      inst.crash(sfxBus, t, 0.2);
    }
  },
  win() {
    if (!ready()) return;
    const t = T0();
    inst.braam(sfxBus, t, [26, 38, 45], 2.5, 0.1);
    inst.crash(sfxBus, t, 0.2);
    const fan = [[62, 0], [69, 0.18], [74, 0.36], [78, 0.54], [81, 0.72]];
    for (const [m, d] of fan) inst.ens(sfxBus, t + d, m - 12, d === 0.72 ? 2.2 : 0.3, { vol: 0.07, cutoff: 2200, a: 0.02, r: 0.6, voices: 3, filterEnv: 2, wet: 0.55 });
    for (const m of [62, 66, 69, 74]) inst.choir(sfxBus, t + 0.72, m, 2.2, 0.05);
    for (let i = 0; i < 8; i++) inst.taiko(sfxBus, t + 0.72 + i * 0.09, 0.4 + i * 0.07, (i % 2 ? 0.3 : -0.3), 1 + i * 0.05);
    inst.taiko(sfxBus, t + 1.5, 1, 0, 0.6);
  },
  lose() {
    if (!ready()) return;
    const t = T0();
    inst.braam(sfxBus, t, [26, 33, 38], 2.8, 0.1);
    for (const [m, d] of [[69, 0], [65, 0.3], [62, 0.6], [57, 0.9]]) inst.ens(sfxBus, t + d, m - 12, 0.5, { vol: 0.06, cutoff: 1400, a: 0.03, r: 0.6, voices: 2, filterEnv: 1.6, wet: 0.5 });
    inst.taiko(sfxBus, t + 1.2, 1, 0, 0.55);
  },
  /** time is up */
  timeUp() {
    if (!ready()) return;
    const t = T0();
    inst.braam(sfxBus, t, [26, 38, 45, 50], 3, 0.12);
    inst.crash(sfxBus, t, 0.2);
    inst.taiko(sfxBus, t, 1, 0, 0.55);
  },
  step() {
    if (!ready()) return;
    const t = T0();
    const n = noise();
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = 520;
    const g = ctx.createGain();
    adsr(g.gain, t, { a: 0.002, d: 0.05, s: 0.0001, r: 0.02, peak: 0.12, dur: 0.005 });
    n.connect(f).connect(g).connect(out(sfxBus, { wet: 0.1 }));
    n.start(t, Math.random()); n.stop(t + 0.1);
  },
  click() {
    if (!ready()) return;
    const t = T0();
    inst.pluck(sfxBus, t, 86, 0.04);
  },
  /** the slap on the neck */
  slap() {
    if (!ready()) return;
    const t = T0();
    // sharp skin crack
    const n = noise();
    const f = ctx.createBiquadFilter();
    f.type = 'highpass'; f.frequency.value = 1400;
    const g = ctx.createGain();
    adsr(g.gain, t, { a: 0.0005, d: 0.06, s: 0.0001, r: 0.03, peak: 1.2, dur: 0.002 });
    n.connect(f).connect(g).connect(out(sfxBus, { wet: 0.45 }));
    n.start(t, Math.random()); n.stop(t + 0.2);
    inst.taiko(sfxBus, t, 0.7, 0, 1.5);
    // cartoon "boing" + twinkling stars
    const o = osc('triangle', 520, t + 0.05, t + 0.6);
    o.frequency.exponentialRampToValueAtTime(140, t + 0.45);
    const og = ctx.createGain();
    adsr(og.gain, t + 0.05, { a: 0.005, d: 0.4, s: 0.0001, r: 0.1, peak: 0.12, dur: 0.01 });
    const lfo = osc('sine', 18, t, t + 0.6); const lg = ctx.createGain(); lg.gain.value = 60;
    lfo.connect(lg).connect(o.frequency);
    o.connect(og).connect(out(sfxBus, { wet: 0.3 }));
    for (let i = 0; i < 5; i++) inst.pluck(sfxBus, t + 0.25 + i * 0.09, 93 + (i % 3) * 3, 0.03, (i - 2) * 0.3);
  },
  whoosh() {
    if (!ready()) return;
    inst.swell(sfxBus, T0(), 0.35, 0.2, 300, 2500);
  }
};
