// Tiny synthesized sound engine (no audio files needed -> fully offline).
let ctx = null;
let master = null;
let muted = false;
try { muted = localStorage.getItem('sw-muted') === '1'; } catch { /* ignore */ }

function ac() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.7;
    const comp = ctx.createDynamicsCompressor();
    master.connect(comp).connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

export function unlockAudio() { ac(); }
export function isMuted() { return muted; }
export function setMuted(m) {
  muted = m;
  try { localStorage.setItem('sw-muted', m ? '1' : '0'); } catch { /* ignore */ }
  if (master) master.gain.value = m ? 0 : 0.7;
}

let noiseBuf = null;
function noise() {
  if (!noiseBuf) {
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const s = ctx.createBufferSource();
  s.buffer = noiseBuf;
  return s;
}

function env(g, t, a, peak, d) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
}

function tone(type, f0, f1, dur, vol = 0.4, when = 0) {
  if (!ac()) return;
  const t = ctx.currentTime + when;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
  env(g, t, 0.005, vol, dur);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + dur + 0.05);
}

function burst(dur, vol, freq, q = 1, type = 'lowpass', when = 0) {
  if (!ac()) return;
  const t = ctx.currentTime + when;
  const n = noise();
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.setValueAtTime(freq, t);
  f.frequency.exponentialRampToValueAtTime(Math.max(60, freq * 0.25), t + dur);
  f.Q.value = q;
  const g = ctx.createGain();
  env(g, t, 0.003, vol, dur);
  n.connect(f).connect(g).connect(master);
  n.start(t, Math.random() * 0.5);
  n.stop(t + dur + 0.05);
}

export const sfx = {
  swing() { burst(0.12, 0.12, 2500, 0.7, 'bandpass'); },
  thud() { tone('sine', 140, 50, 0.18, 0.5); burst(0.08, 0.15, 900); },
  smash(pitch = 1) {
    tone('sine', 180 * pitch, 40, 0.25, 0.8);
    tone('triangle', 520 * pitch, 90, 0.12, 0.25);
    burst(0.35, 0.5, 5200, 0.8);
    burst(0.18, 0.35, 1800, 2, 'bandpass', 0.02);
    // glassy debris tinkles
    for (let i = 0; i < 5; i++) tone('sine', 1800 + Math.random() * 2200, 1500, 0.06, 0.05, 0.05 + Math.random() * 0.25);
  },
  splat() { burst(0.25, 0.35, 700, 3); tone('sine', 90, 40, 0.2, 0.3); },
  error() {
    tone('square', 220, 220, 0.16, 0.18);
    tone('square', 165, 165, 0.32, 0.18, 0.17);
    tone('sawtooth', 70, 50, 0.45, 0.25);
  },
  combo(level = 1) {
    const base = 520 * Math.pow(1.12, level);
    [0, 4, 7, 12].forEach((s, i) => tone('triangle', base * Math.pow(2, s / 12), base * Math.pow(2, s / 12), 0.12, 0.15, i * 0.05));
  },
  pop() { tone('sine', 300, 600, 0.08, 0.12); },
  beep(hi = false) { tone('square', hi ? 1040 : 660, hi ? 1040 : 660, hi ? 0.35 : 0.12, 0.15); },
  win() {
    const notes = [0, 4, 7, 12, 7, 12, 16, 19, 24];
    notes.forEach((s, i) => tone('triangle', 392 * Math.pow(2, s / 12), 392 * Math.pow(2, s / 12), 0.22, 0.2, i * 0.11));
    burst(1.2, 0.08, 9000, 0.5, 'highpass', 0.9);
  },
  lose() {
    [0, -3, -6, -10].forEach((s, i) => tone('sawtooth', 300 * Math.pow(2, s / 12), 280 * Math.pow(2, s / 12), 0.3, 0.15, i * 0.25));
  },
  step() { burst(0.05, 0.05, 600, 1); },
  click() { tone('sine', 900, 1200, 0.05, 0.1); }
};
