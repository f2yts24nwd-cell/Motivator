// Epic, fully synthesized audio engine (no audio files -> works offline as PWA).
// Orchestral-style instruments (taiko, strings, brass, choir, risers, "braaam" impacts)
// running through a generated concert-hall reverb, plus a lookahead music sequencer.

let ctx = null;
let master, comp, musicBus, sfxBus, reverb, reverbSend, delaySend;
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
    // tempo-synced feedback delay (dotted 8th at 124 BPM) for the techno plucks and leads
    delaySend = ctx.createGain();
    const dl = ctx.createDelay(1.5);
    dl.delayTime.value = (60 / 124) * 0.75;
    const fb = ctx.createGain();
    fb.gain.value = 0.38;
    const dTone = ctx.createBiquadFilter();
    dTone.type = 'lowpass';
    dTone.frequency.value = 2600;
    const dRet = ctx.createGain();
    dRet.gain.value = 0.5;
    delaySend.connect(dl).connect(dTone).connect(fb).connect(dl);
    dTone.connect(dRet).connect(master);
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
// ------------------------------------------------------------------ recorded songs (audio files)
// Songs play as a plain <audio> element, NOT through WebAudio: on the iPhone, WebAudio is silent
// while the ring/silent switch is on, media elements are not. Volume fades work where the browser
// allows it (iOS ignores element.volume, there the song simply starts/stops).
// iOS/iPadOS only lets an element play later without a tap if THAT element was started inside a
// gesture before. So there is exactly one <audio> element for all songs: switching songs only
// changes its src (a new element per song would be blocked, e.g. when the next song starts by itself).
const song = { el: null, url: null, playing: false, volume: 0.8, fadeTimer: null, startedAt: 0, priming: false };
window.__song = song; // for debugging / automated checks
function songElement(url) {
  let el = song.el;
  if (!el) {
    el = new Audio();
    el.preload = 'auto';
    el.playsInline = true;
    el.setAttribute('playsinline', '');
    el.addEventListener('ended', () => {
      if (song.priming) return;
      const played = el.currentTime;
      song.playing = false;
      // a real end only after the song actually ran; otherwise it failed to load
      if (played > 3) music.onSongEnd?.(song.url);
      else music.onSongError?.(song.url);
    });
    el.addEventListener('error', () => {
      if (!song.url) return;
      song.playing = false;
      music.onSongError?.(song.url);
    });
    song.el = el;
  }
  if (song.url !== url) {
    el.pause();
    song.url = url;
    el.src = url;
    el.load();
  }
  el.muted = muted;
  return el;
}
function fadeSong(to, secs, done) {
  const el = song.el;
  clearInterval(song.fadeTimer);
  if (!el) return;
  const from = el.volume;
  const t0 = performance.now();
  song.fadeTimer = setInterval(() => {
    const k = Math.min(1, (performance.now() - t0) / (secs * 1000));
    try { el.volume = Math.max(0, Math.min(1, from + (to - from) * k)); } catch { /* iOS: read-only */ }
    if (k >= 1) { clearInterval(song.fadeTimer); done?.(); }
  }, 50);
}
/** Call inside a tap: loads a song and unlocks the (single) element for later playback on iOS. */
export function primeSong(url) {
  if (song.playing) return;
  const el = songElement(url);
  song.priming = true;
  el.muted = true; // iOS ignores volume, so prime silently
  const done = () => { song.priming = false; if (!song.playing) { el.pause(); el.currentTime = 0; } el.muted = muted; };
  const p = el.play();
  if (p?.then) p.then(done).catch(done); else done();
}
export function suspendAudio() {
  if (ctx && ctx.state === 'running') ctx.suspend();
  if (song.el && song.playing) song.el.pause();
}
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && song.playing && song.el?.paused) song.el.play().catch(() => {});
});
export function isMuted() { return muted; }
export function setMuted(m) {
  muted = m;
  try { localStorage.setItem('sw-muted', m ? '1' : '0'); } catch { /* ignore */ }
  if (master) master.gain.setTargetAtTime(m ? 0 : 0.9, ctx.currentTime, 0.05);
  if (song.el && !song.priming) song.el.muted = m;
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
function out(bus, { pan = 0, wet = 0.25, delay = 0 } = {}) {
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
  if (delay > 0) {
    const d = ctx.createGain();
    d.gain.value = delay;
    node.connect(d).connect(delaySend);
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

// ------------------------------------------------------------------ techno instruments
Object.assign(inst, {
  /** 909-style kick: pitch-dropping sine + click */
  kick(bus, t, vol = 1) {
    const dest = out(bus, { wet: 0 });
    const o = osc('sine', 160, t, t + 0.5);
    o.frequency.exponentialRampToValueAtTime(46, t + 0.11);
    const g = ctx.createGain();
    adsr(g.gain, t, { a: 0.001, d: 0.38, s: 0.0001, r: 0.1, peak: 0.95 * vol, dur: 0.01 });
    const sh = ctx.createWaveShaper();
    const curve = new Float32Array(256);
    for (let i = 0; i < 256; i++) { const x = i / 128 - 1; curve[i] = Math.tanh(x * 1.8); }
    sh.curve = curve;
    o.connect(g).connect(sh).connect(dest);
    const n = noise();
    const f = ctx.createBiquadFilter();
    f.type = 'highpass'; f.frequency.value = 2500;
    const ng = ctx.createGain();
    adsr(ng.gain, t, { a: 0.0005, d: 0.012, s: 0.0001, r: 0.01, peak: 0.35 * vol, dur: 0.002 });
    n.connect(f).connect(ng).connect(dest);
    n.start(t, Math.random()); n.stop(t + 0.05);
  },
  hat(bus, t, vol = 0.1, open = false, pan = 0) {
    const dest = out(bus, { pan, wet: open ? 0.2 : 0.05 });
    const n = noise();
    const f = ctx.createBiquadFilter();
    f.type = 'highpass'; f.frequency.value = open ? 6500 : 8000;
    const b = ctx.createBiquadFilter();
    b.type = 'peaking'; b.frequency.value = 10500; b.gain.value = 6;
    const g = ctx.createGain();
    adsr(g.gain, t, { a: 0.001, d: open ? 0.32 : 0.045, s: 0.0001, r: open ? 0.1 : 0.02, peak: vol, dur: 0.003 });
    n.connect(f).connect(b).connect(g).connect(dest);
    n.start(t, Math.random()); n.stop(t + (open ? 0.6 : 0.15));
  },
  clap(bus, t, vol = 0.3) {
    const dest = out(bus, { wet: 0.4, pan: 0.05 });
    const n = noise();
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass'; f.frequency.value = 1300; f.Q.value = 1.4;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    for (const k of [0, 0.011, 0.022]) {
      g.gain.setValueAtTime(vol, t + k);
      g.gain.exponentialRampToValueAtTime(vol * 0.15, t + k + 0.009);
    }
    g.gain.setValueAtTime(vol * 0.8, t + 0.033);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    n.connect(f).connect(g).connect(dest);
    n.start(t, Math.random()); n.stop(t + 0.3);
  },
  /** rolling techno bass: saw + sub, resonant lowpass with a snappy envelope */
  bass(bus, t, midi, dur, { vol = 0.11, cutoff = 520, q = 7 } = {}) {
    const dest = out(bus, { wet: 0.04 });
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass'; f.Q.value = q;
    f.frequency.setValueAtTime(cutoff * 3.2, t);
    f.frequency.exponentialRampToValueAtTime(cutoff, t + Math.min(0.09, dur));
    const g = ctx.createGain();
    adsr(g.gain, t, { a: 0.003, d: 0.08, s: 0.6, r: 0.04, peak: vol, dur });
    f.connect(g).connect(dest);
    osc('sawtooth', mtof(midi), t, t + dur + 0.1, rnd(-4, 4)).connect(f);
    const sub = osc('sine', mtof(midi - 12), t, t + dur + 0.1);
    const sg = ctx.createGain(); sg.gain.value = 0.9;
    sub.connect(sg).connect(g);
  },
  /** bright pluck with filter envelope, sent into the delay */
  arp(bus, t, midi, { vol = 0.04, pan = 0, cutoff = 2600, delay = 0.45, wet = 0.35 } = {}) {
    const dest = out(bus, { pan, wet, delay });
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass'; f.Q.value = 3;
    f.frequency.setValueAtTime(cutoff * 2.5, t);
    f.frequency.exponentialRampToValueAtTime(Math.max(200, cutoff * 0.35), t + 0.22);
    const g = ctx.createGain();
    adsr(g.gain, t, { a: 0.002, d: 0.25, s: 0.0001, r: 0.1, peak: vol, dur: 0.01 });
    f.connect(g).connect(dest);
    for (const det of [-7, 7]) osc('sawtooth', mtof(midi), t, t + 0.6, det).connect(f);
    osc('square', mtof(midi + 12), t, t + 0.3).connect(f);
  }
});

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

// Melodic techno for "Rettet den Feierabend!" (A minor, 124 BPM).
// intensity: -1 breakdown (no kick), 0 groove, 1 + clap & arp, 2 + open hats & pads, 3 drop with lead
const TECH = {
  Am: { root: 33, tones: [57, 60, 64, 67] },
  F: { root: 29, tones: [53, 57, 60, 64] },
  C: { root: 36, tones: [55, 60, 64, 67] },
  G: { root: 31, tones: [55, 59, 62, 67] },
  Em: { root: 28, tones: [55, 59, 64, 67] }
};
THEMES.techno = {
  bpm: 124,
  prog: ['Am', 'Am', 'F', 'F', 'C', 'C', 'G', 'Em'],
  arpPat: [0, 2, 1, 3, 2, 0, 3, 1, 0, 2, 1, 3, 2, 3, 1, 2],
  lead: [[76, 6], [74, 2], [72, 4], [71, 4], [72, 6], [74, 2], [76, 8], [79, 6], [77, 2], [76, 4], [74, 4], [72, 8], [71, 8]],
  step(bus, s, t, sd, bar, I) {
    if (this.duckBus !== bus) {
      // sidechain bus: pads, bass and arps pump with the kick
      this.duck = ctx.createGain();
      this.duck.connect(bus);
      this.duckBus = bus;
    }
    const D = this.duck;
    const ch = TECH[this.prog[bar % this.prog.length]];
    const brk = I < 0;
    if (!brk && s % 4 === 0) {
      inst.kick(bus, t, s === 0 ? 1 : 0.92);
      D.gain.cancelScheduledValues(t);
      D.gain.setValueAtTime(0.28, t);
      D.gain.linearRampToValueAtTime(1, t + sd * 3.2);
    }
    if (brk && s === 0) { D.gain.cancelScheduledValues(t); D.gain.setValueAtTime(1, t); }
    // rolling bass on the off-16ths
    if (!brk && s % 4 !== 0) {
      const oct = s % 4 === 2 && (bar % 2 === 1) ? 12 : 0;
      inst.bass(D, t, ch.root + 12 + oct, sd * 0.85, { vol: 0.1, cutoff: 380 + Math.max(0, I) * 160 + (s % 4 === 2 ? 120 : 0) });
    }
    // hats
    if (!brk) {
      if (s % 4 === 2) inst.hat(bus, t, I >= 2 ? 0.07 : 0.09, I >= 2, 0.15);
      if (I >= 1 && s % 2 === 1) inst.hat(bus, t, 0.025 + (s % 4 === 3 ? 0.012 : 0), false, -0.25);
      if (I >= 3 && s % 4 === 0) inst.hat(bus, t, 0.03, false, 0.3);
    }
    if (!brk && I >= 1 && (s === 4 || s === 12)) inst.clap(bus, t, 0.24);
    // pads (every 2 bars)
    if (s === 0 && bar % 2 === 0 && (I >= 2 || brk)) {
      for (const m of ch.tones) inst.ens(D, t, m - 12, sd * 31, { vol: brk ? 0.02 : 0.014, cutoff: brk ? 900 : 1600, a: 0.9, r: 1.5, voices: 2, spread: 12, wet: 0.7 });
    }
    // arpeggio
    if (I >= 1 || brk) {
      const every = I >= 2 || brk ? 1 : 2;
      if (s % every === 0) {
        const n = ch.tones[this.arpPat[s]] + (s >= 8 && I >= 2 ? 12 : 0);
        const open = 0.5 + 0.5 * Math.sin((bar * 16 + s) / 32 * Math.PI);
        inst.arp(D, t, n, { vol: brk ? 0.03 : 0.028, pan: (s % 4 - 1.5) * 0.25, cutoff: brk ? 900 : 1200 + open * 2600 });
      }
    }
    // lead melody on the drop
    if (I >= 3) {
      const pos = (bar % 4) * 16 + s;
      let acc = 0;
      for (const [m, len] of this.lead) {
        if (acc === pos) inst.ens(D, t, m, sd * len * 0.92, { vol: 0.03, cutoff: 3000, a: 0.01, r: 0.25, voices: 3, spread: 14, filterEnv: 1.8, wet: 0.35 });
        acc += len;
        if (acc > 64) break;
      }
    }
    if (!brk && s === 0 && bar % 8 === 0 && I >= 2) inst.crash(bus, t, 0.07);
    if (!brk && bar % 8 === 7 && s === 0 && I >= 1) inst.swell(bus, t, sd * 16, 0.04 + I * 0.012, 600, 8000);
  }
};

// 90s Eurodance / tuner soundtrack for "Mission RC 0" (F minor, 140 BPM).
// intensity: -1 breakdown, 0 groove, 1 + stabs & claps, 2 + arp & pads, 3 + lead, 4 boss fight (taiko + braams)
const RUSH = {
  Fm: { root: 29, tones: [53, 56, 60] },
  Db: { root: 25, tones: [49, 53, 56] },
  Ab: { root: 32, tones: [56, 60, 63] },
  Eb: { root: 27, tones: [51, 55, 58] }
};
THEMES.rush = {
  bpm: 140,
  prog: ['Fm', 'Fm', 'Db', 'Db', 'Ab', 'Ab', 'Eb', 'Eb'],
  stabs: [0, 3, 6, 10, 12],
  lead: [[72, 3], [72, 3], [75, 2], [77, 4], [75, 4], [72, 6], [70, 2], [68, 4], [67, 4], [68, 3], [70, 3], [72, 10], [0, 16]],
  step(bus, s, t, sd, bar, I) {
    if (this.duckBus !== bus) {
      this.duck = ctx.createGain();
      this.duck.connect(bus);
      this.duckBus = bus;
    }
    const D = this.duck;
    const ch = RUSH[this.prog[bar % this.prog.length]];
    const brk = I < 0;
    if (!brk && s % 4 === 0) {
      inst.kick(bus, t, 1);
      D.gain.cancelScheduledValues(t);
      D.gain.setValueAtTime(0.3, t);
      D.gain.linearRampToValueAtTime(1, t + sd * 2.8);
    }
    if (brk && s === 0) { D.gain.cancelScheduledValues(t); D.gain.setValueAtTime(1, t); }
    // the pumping off-beat octave bass
    if (!brk && s % 4 === 2) inst.bass(D, t, ch.root + 24, sd * 1.6, { vol: 0.12, cutoff: 700 + Math.max(0, I) * 180, q: 5 });
    if (!brk && I >= 2 && s % 4 === 3) inst.bass(D, t, ch.root + 12, sd * 0.7, { vol: 0.07, cutoff: 500 });
    // hats + claps
    if (!brk) {
      if (s % 4 === 2) inst.hat(bus, t, 0.08, true, 0.1);
      if (I >= 1) inst.hat(bus, t, s % 2 ? 0.03 : 0.018, false, s % 2 ? -0.25 : 0.25);
      if (I >= 1 && (s === 4 || s === 12)) inst.clap(bus, t, 0.26);
    }
    // supersaw stabs
    if (!brk && I >= 1 && this.stabs.includes(s)) {
      for (const m of ch.tones) inst.ens(D, t, m + 12, sd * 1.3, { vol: 0.022, cutoff: 3200, a: 0.004, r: 0.12, voices: 3, spread: 18, filterEnv: 1.6, wet: 0.3 });
    }
    // pads
    if (s === 0 && bar % 2 === 0 && (I >= 2 || brk)) {
      for (const m of ch.tones) inst.ens(D, t, m, sd * 31, { vol: brk ? 0.022 : 0.012, cutoff: brk ? 1000 : 1800, a: 0.8, r: 1.4, voices: 2, spread: 12, wet: 0.7 });
    }
    // pluck arpeggio
    if (I >= 2 || brk) {
      const n = ch.tones[s % 3] + 12 + (s >= 8 ? 12 : 0);
      if (s % 2 === 0 || I >= 3) inst.arp(D, t, n, { vol: brk ? 0.03 : 0.024, pan: (s % 4 - 1.5) * 0.25, cutoff: brk ? 1000 : 2600, delay: 0.25 });
    }
    // lead hook
    if (I >= 3) {
      const pos = (bar % 4) * 16 + s;
      let acc = 0;
      for (const [m, len] of this.lead) {
        if (acc === pos && m) inst.ens(D, t, m, sd * len * 0.9, { vol: 0.03, cutoff: 3400, a: 0.01, r: 0.2, voices: 3, spread: 16, filterEnv: 1.6, wet: 0.35 });
        acc += len;
        if (acc > 64) break;
      }
    }
    // boss fight: war drums and braams on top
    if (I >= 4) {
      if (s === 0 || s === 6 || s === 8 || s === 11) inst.taiko(bus, t, s === 0 ? 1 : 0.6, (s % 3 - 1) * 0.3, 0.8);
      if (s === 0 && bar % 2 === 0) inst.braam(bus, t, [ch.root + 12, ch.root + 19], 1.4, 0.05);
    }
    if (!brk && s === 0 && bar % 8 === 0 && I >= 1) inst.crash(bus, t, 0.07);
    if (!brk && bar % 8 === 7 && s === 0 && I >= 1) inst.swell(bus, t, sd * 16, 0.05, 600, 9000);
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
    this.stopSong(1.2);
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
  kick() {
    if (this.wantedSong) { const u = this.wantedSong; this.wantedSong = null; this.playSong(u); return; }
    const w = this.wanted; this.current = null; if (w) this.play(w);
  },
  /** Plays a recorded song instead of the synthesized themes. restart: from the beginning. */
  playSong(url, { restart = false, loop = true } = {}) {
    this.stop(1.5);
    this.wanted = null;
    this.wantedSong = null;
    const el = songElement(url);
    song.priming = false;
    el.loop = loop;
    el.muted = muted;
    if (song.playing && !restart && !el.paused) return;
    if (restart || el.ended) { try { el.currentTime = 0; } catch { /* not loaded yet */ } }
    song.playing = true;
    song.startedAt = performance.now();
    try { el.volume = 0; } catch { /* ignore */ }
    const p = el.play();
    const ok = () => fadeSong(song.volume, 2);
    if (p?.then) p.then(ok).catch((e) => { if (song.url !== url) return; song.playing = false; this.onSongError?.(url, e); });
    else ok();
  },
  stopSong(fade = 1) {
    this.wantedSong = null;
    if (!song.playing || !song.el) return;
    song.playing = false;
    const el = song.el;
    fadeSong(0, fade, () => { if (!song.playing) el.pause(); });
    // iOS ignores the volume fade: pause right after it
    setTimeout(() => { if (!song.playing) el.pause(); }, fade * 1000 + 150);
  },
  get songPlaying() { return song.playing; },
  /** { url, playing, t, dur } of the current song element (for the jukebox) */
  songState() {
    const el = song.el;
    return { url: song.url, playing: song.playing, t: el?.currentTime || 0, dur: el && isFinite(el.duration) ? el.duration : 0 };
  },
  seekSong(t) { if (song.el) song.el.currentTime = Math.max(0, t); },
  /** called when a non-looping song ends */
  onSongEnd: null,
  /** called when a song cannot be loaded or played */
  onSongError: null
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
  },
  /** tool bolt launched */
  zap(pan = 0) {
    if (!ready()) return;
    const t = T0();
    const dest = out(sfxBus, { pan, wet: 0.2, delay: 0.15 });
    const o = osc('sawtooth', 260, t, t + 0.18);
    o.frequency.exponentialRampToValueAtTime(2200, t + 0.12);
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass'; f.Q.value = 3;
    f.frequency.setValueAtTime(600, t);
    f.frequency.exponentialRampToValueAtTime(5000, t + 0.12);
    const g = ctx.createGain();
    adsr(g.gain, t, { a: 0.003, d: 0.12, s: 0.0001, r: 0.04, peak: 0.16, dur: 0.01 });
    o.connect(f).connect(g).connect(dest);
  },
  /** low hanging fruit picked */
  fruit() {
    if (!ready()) return;
    const t = T0();
    [69, 73, 76, 81, 85].forEach((m, i) => inst.arp(sfxBus, t + i * 0.045, m + 12, { vol: 0.07, cutoff: 3500, delay: 0.3, pan: (i - 2) * 0.3 }));
    inst.taiko(sfxBus, t, 0.4, 0, 2);
  },
  /** paper lands on the stack */
  rustle(vol = 1) {
    if (!ready()) return;
    const t = T0();
    for (let i = 0; i < 4; i++) {
      const n = noise();
      const f = ctx.createBiquadFilter();
      f.type = 'bandpass'; f.frequency.value = rnd(2200, 4200); f.Q.value = 1.2;
      const g = ctx.createGain();
      adsr(g.gain, t + i * 0.035, { a: 0.004, d: 0.05, s: 0.0001, r: 0.03, peak: 0.35 * vol, dur: 0.01 });
      n.connect(f).connect(g).connect(out(sfxBus, { wet: 0.2, pan: rnd(-0.4, 0.4) }));
      n.start(t + i * 0.035, Math.random()); n.stop(t + i * 0.035 + 0.15);
    }
    inst.taiko(sfxBus, t, 0.35 * vol, 0.3, 1.8);
  },
  /** "Richtig gelassen" chime */
  chime() {
    if (!ready()) return;
    const t = T0();
    inst.arp(sfxBus, t, 79, { vol: 0.07, cutoff: 3000, delay: 0.35 });
    inst.arp(sfxBus, t + 0.12, 84, { vol: 0.07, cutoff: 3000, delay: 0.35 });
  },
  /** the Extra Meile drop */
  drop() {
    if (!ready()) return;
    const t = T0();
    inst.braam(sfxBus, t, [33, 40, 45], 1.8, 0.11);
    inst.crash(sfxBus, t, 0.16);
    inst.kick(sfxBus, t, 1.2);
  },
  riser(dur = 1.6) {
    if (!ready()) return;
    inst.swell(sfxBus, T0(), dur, 0.18, 400, 9000);
  },
  avalanche() {
    if (!ready()) return;
    const t = T0();
    inst.braam(sfxBus, t, [28, 29, 35], 2.2, 0.14);
    for (let i = 0; i < 10; i++) setTimeout(() => sfx.rustle(0.8), i * 70);
  },
  /** exhaust backfire: crack + thump */
  backfire(pan = 0) {
    if (!ready()) return;
    const t = T0();
    const n = noise();
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(3800, t);
    f.frequency.exponentialRampToValueAtTime(300, t + 0.2);
    const g = ctx.createGain();
    adsr(g.gain, t, { a: 0.001, d: 0.12, s: 0.0001, r: 0.05, peak: 0.9, dur: 0.01 });
    n.connect(f).connect(g).connect(out(sfxBus, { pan, wet: 0.3 }));
    n.start(t, Math.random()); n.stop(t + 0.3);
    const sub = osc('sine', 90, t, t + 0.3);
    sub.frequency.exponentialRampToValueAtTime(35, t + 0.25);
    const sg = ctx.createGain();
    adsr(sg.gain, t, { a: 0.001, d: 0.2, s: 0.0001, r: 0.05, peak: 0.8, dur: 0.01 });
    sub.connect(sg).connect(out(sfxBus, { pan, wet: 0.1 }));
  },
  /** engine rev of the CRX, ending in backfires */
  rev(dur = 1.4) {
    if (!ready()) return;
    const t = T0();
    const dest = out(sfxBus, { wet: 0.15 });
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass'; f.Q.value = 4;
    f.frequency.setValueAtTime(300, t);
    f.frequency.exponentialRampToValueAtTime(2200, t + dur * 0.8);
    const g = ctx.createGain();
    adsr(g.gain, t, { a: 0.08, d: 0.2, s: 0.9, r: 0.3, peak: 0.22, dur: dur * 0.85 });
    for (const det of [0, 9]) {
      const o = osc('sawtooth', 55, t, t + dur + 0.3, det);
      o.frequency.setValueAtTime(55, t);
      o.frequency.exponentialRampToValueAtTime(95, t + dur * 0.3);
      o.frequency.exponentialRampToValueAtTime(70, t + dur * 0.4);
      o.frequency.exponentialRampToValueAtTime(190, t + dur * 0.85);
      // rumble: fast amplitude wobble of a big engine
      const lfo = osc('square', 28, t, t + dur + 0.3);
      const lg = ctx.createGain(); lg.gain.value = 10;
      lfo.connect(lg).connect(o.frequency);
      o.connect(f);
    }
    f.connect(g).connect(dest);
    [0.9, 1.0, 1.18].forEach((k) => setTimeout(() => sfx.backfire((Math.random() - 0.5) * 0.6), dur * k * 1000));
  },
  /** the oracle speaks: choir chord, shimmer and bells */
  oracle() {
    if (!ready()) return;
    const t = T0();
    for (const m of [62, 66, 69, 74]) inst.choir(sfxBus, t, m, 2.4, 0.05);
    inst.swell(sfxBus, t, 1.2, 0.1, 2000, 12000);
    [86, 90, 93, 98].forEach((m, i) => inst.pluck(sfxBus, t + 0.2 + i * 0.12, m, 0.04, (i - 1.5) * 0.4));
  },
  /** sad trombone for the uninstalled CRM */
  sadTrombone() {
    if (!ready()) return;
    const t = T0();
    [[58, 0, 0.42], [57, 0.45, 0.42], [56, 0.9, 0.42], [55, 1.35, 1.3]].forEach(([m, d, len], i) => {
      const dest = out(sfxBus, { wet: 0.3 });
      const o = osc('sawtooth', mtof(m - 12), t + d, t + d + len + 0.1);
      if (i === 3) {
        const lfo = osc('sine', 6, t + d, t + d + len + 0.1);
        const lg = ctx.createGain(); lg.gain.value = 4;
        lfo.connect(lg).connect(o.frequency);
      }
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass'; f.frequency.value = 900; f.Q.value = 6;
      const g = ctx.createGain();
      adsr(g.gain, t + d, { a: 0.04, d: 0.1, s: 0.8, r: 0.15, peak: 0.12, dur: len });
      o.connect(f).connect(g).connect(dest);
    });
  }
};

// ------------------------------------------------------------------ "Das CRM-Königreich"
// Medieval folk by day (lute, frame drum, flute), war drums and choir by night.
// intensity: -1 intro, 0 morning, 1 busy day, 2 dusk, 3 night, 4 boss night
THEMES.kingdom = {
  bpm: 112,
  dayProg: ['Dm', 'C', 'Bb', 'C', 'Dm', 'F', 'C', 'Dm'],
  nightProg: ['Dm', 'Bb', 'Gm', 'A', 'Dm', 'Bb', 'C', 'A'],
  flute: [[74, 4], [76, 2], [77, 2], [79, 4], [77, 2], [76, 2], [74, 6], [72, 2], [74, 8], [69, 4], [72, 4], [74, 2], [76, 2], [77, 4], [76, 4], [74, 8], [0, 4]],
  step(bus, s, t, sd, bar, I) {
    const night = I >= 3;
    const prog = night ? this.nightProg : this.dayProg;
    const ch = prog[bar % prog.length];
    const T = tones(ch, 24);
    const root = CH[ch][0];
    if (!night) {
      // lute: rolling eighths
      if (s % 2 === 0) {
        const pat = [0, 1, 2, 1, 0, 2, 1, 2];
        const n = T[pat[(s / 2) % 8]] + 12 + (s >= 8 && I >= 1 ? 12 : 0);
        inst.pluck(bus, t, n, I < 0 ? 0.035 : 0.045, ((s / 2) % 4 - 1.5) * 0.25);
      }
      // drone + pad
      if (s === 0) {
        inst.ens(bus, t, root + 12, sd * 15.5, { vol: 0.05, cutoff: 520, a: 0.2, r: 0.6, voices: 2, wet: 0.3 });
        if (I >= 2 || I < 0) for (const m of T) inst.ens(bus, t, m, sd * 15.5, { vol: 0.016, cutoff: 1300, a: 0.5, r: 1, voices: 2, wet: 0.55 });
      }
      if (I >= 0) {
        // frame drum and shaker
        if (s === 0 || s === 8) inst.taiko(bus, t, 0.6, 0, 1.25);
        if (s === 6 || s === 14) inst.taiko(bus, t, 0.32, 0.25, 1.6);
        if (s % 2 === 1) inst.hat(bus, t, 0.022, false, s % 4 === 1 ? -0.3 : 0.3);
        if (I >= 2 && (s === 4 || s === 12)) inst.snare(bus, t, 0.35);
      }
      // flute melody from intensity 1
      if (I >= 1) {
        const pos = (bar % 4) * 16 + s;
        let acc = 0;
        for (const [m, len] of this.flute) {
          if (acc === pos && m) inst.ens(bus, t, m, sd * len * 0.92, { vol: 0.042, cutoff: 2600, a: 0.04, r: 0.3, voices: 1, wet: 0.45, type: 'triangle', pan: -0.15 });
          acc += len;
          if (acc > 64) break;
        }
      }
      if (s === 0 && bar % 8 === 0 && I >= 1) inst.crash(bus, t, 0.05);
    } else {
      // night: low string ostinato, war drums, choir
      const pat = [0, 0, 2, 0, 1, 0, 2, 1, 0, 0, 2, 0, 1, 2, 1, 2];
      inst.ens(bus, t, T[pat[s]] - (s % 4 === 0 ? 12 : 0), sd * 0.8, { vol: 0.04, cutoff: 1100 + (I - 3) * 600, a: 0.006, r: 0.08, voices: 2, wet: 0.2, pan: s % 2 ? 0.2 : -0.2 });
      if (s % 2 === 0) inst.ens(bus, t, root, sd * 1.6, { vol: 0.07, cutoff: 600, a: 0.01, r: 0.1, voices: 2, wet: 0.1 });
      const drums = [1, 0, 0, 0.5, 0, 0, 0.8, 0, 1, 0, 0.5, 0, 0, 0.6, 0.7, 0.9];
      if (drums[s]) inst.taiko(bus, t, drums[s] * 0.9, (s % 3 - 1) * 0.25, 0.75);
      if (s === 4 || s === 12) inst.snare(bus, t, 0.6);
      if (s === 0) for (const m of T) inst.choir(bus, t, m + 12, sd * 15, 0.032);
      if (s === 0 && bar % 2 === 0) inst.braam(bus, t, [root, root + 7], 1.6, I >= 4 ? 0.07 : 0.04);
      if (I >= 4 && s % 2 === 1) inst.taiko(bus, t, 0.4, (s % 4 - 2) * 0.2, 1.1);
      if (bar % 4 === 3 && s === 0) inst.swell(bus, t, sd * 16, 0.06);
    }
  }
};

Object.assign(sfx, {
  /** pickaxe on stone */
  mine(pan = 0) {
    if (!ready()) return;
    const t = T0();
    inst.taiko(sfxBus, t, 0.35, pan, 2.2);
    const dest = out(sfxBus, { pan, wet: 0.25 });
    const o = osc('square', rnd(1700, 2100), t, t + 0.12);
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 2400; f.Q.value = 8;
    const g = ctx.createGain();
    adsr(g.gain, t, { a: 0.001, d: 0.06, s: 0.0001, r: 0.04, peak: 0.12, dur: 0.01 });
    o.connect(f).connect(g).connect(dest);
  },
  /** resource collected */
  coin(n = 0) {
    if (!ready()) return;
    const t = T0();
    inst.arp(sfxBus, t, 84 + (n % 3) * 2, { vol: 0.06, cutoff: 4000, delay: 0.2 });
    inst.arp(sfxBus, t + 0.06, 91 + (n % 3) * 2, { vol: 0.05, cutoff: 4000, delay: 0.2 });
  },
  /** block lands on a tower */
  place() {
    if (!ready()) return;
    const t = T0();
    inst.taiko(sfxBus, t, 0.9, 0, 0.9);
    inst.taiko(sfxBus, t + 0.01, 0.4, 0, 2.0);
    [74, 78, 81].forEach((m, i) => inst.pluck(sfxBus, t + 0.05 + i * 0.05, m, 0.045, (i - 1) * 0.3));
  },
  /** royal fanfare */
  fanfare() {
    if (!ready()) return;
    const t = T0();
    [[62, 0, 0.18], [62, 0.2, 0.12], [62, 0.34, 0.12], [69, 0.5, 0.5], [66, 1.02, 0.18], [69, 1.22, 0.9]].forEach(([m, d, len]) => {
      for (const k of [0, 7, 12]) inst.ens(sfxBus, t + d, m + k - 12, len, { vol: 0.045, cutoff: 2200, a: 0.02, r: 0.25, voices: 2, filterEnv: 2, wet: 0.45 });
    });
    inst.taiko(sfxBus, t, 1, 0, 0.8);
    inst.crash(sfxBus, t + 0.5, 0.12);
  },
  /** monster growl / boss roar */
  roar(big = false) {
    if (!ready()) return;
    const t = T0();
    const dest = out(sfxBus, { wet: 0.4 });
    const o = osc('sawtooth', big ? 70 : 140, t, t + (big ? 1.4 : 0.5));
    o.frequency.exponentialRampToValueAtTime(big ? 38 : 80, t + (big ? 1.2 : 0.4));
    const lfo = osc('sine', big ? 22 : 30, t, t + 1.5);
    const lg = ctx.createGain(); lg.gain.value = big ? 25 : 18;
    lfo.connect(lg).connect(o.frequency);
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = big ? 700 : 1100; f.Q.value = 4;
    const g = ctx.createGain();
    adsr(g.gain, t, { a: 0.03, d: 0.2, s: 0.6, r: 0.3, peak: big ? 0.3 : 0.12, dur: big ? 1.0 : 0.3 });
    o.connect(f).connect(g).connect(dest);
    if (big) inst.braam(sfxBus, t, [26, 27, 33], 1.6, 0.12);
  },
  /** night falls */
  gong() {
    if (!ready()) return;
    const t = T0();
    inst.braam(sfxBus, t, [26, 33, 38], 3, 0.12);
    inst.taiko(sfxBus, t, 1, 0, 0.5);
    for (const m of [50, 57, 62]) inst.choir(sfxBus, t + 0.2, m, 2.6, 0.05);
  },
  /** morning: rooster-ish bright arpeggio */
  morning() {
    if (!ready()) return;
    const t = T0();
    [62, 66, 69, 74, 78, 81].forEach((m, i) => inst.pluck(sfxBus, t + i * 0.07, m + 12, 0.05, (i - 2.5) * 0.25));
    inst.swell(sfxBus, t, 1.2, 0.06, 800, 9000);
  }
});
