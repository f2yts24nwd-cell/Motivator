// Plantafel – minimalistische Tourenplanung für den Außendienst.
// Ursprünglich als eigenständige PWA gebaut; hier als Modul der Spielewelt, komplett im Shadow DOM.
// Die „KI“ ist lokale Planungslogik (Sprachverständnis, Umweg-Berechnung, Reihenfolge-Optimierung).
// Alle Daten bleiben im localStorage des Geräts. Nichts verlässt das iPhone.
import css from './plantafel.css?inline';
import { ensureFonts } from './fonts.js';

/* ================= helpers ================= */
const pad = (n) => String(n).padStart(2, '0');
const fm = (m) => pad(Math.floor(m / 60)) + ':' + pad(Math.round(m) % 60);
const ceil5 = (m) => Math.ceil(m / 5) * 5;
const K = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const P = (k) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
const addD = (k, n) => { const d = P(k); d.setDate(d.getDate() + n); return K(d); };
const wd = (k) => (P(k).getDay() + 6) % 7;
const diffD = (a, b) => Math.round((P(b) - P(a)) / 864e5);
const today = () => K(new Date());
const nowMin = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); };
const uid = () => Math.random().toString(36).slice(2, 9);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const WD = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
const WDL = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];
const MON = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
const dl = (m) => m < 60 ? m + ' min' : Math.floor(m / 60) + ' h' + (m % 60 ? ' ' + pad(m % 60) : '');
const shortLbl = (k) => { const n = diffD(today(), k); if (n === 0) return 'Heute'; if (n === 1) return 'Morgen'; const d = P(k); return WD[wd(k)] + ' ' + d.getDate() + '.' + (d.getMonth() + 1) + '.'; };
const isWork = (k) => wd(k) < 5;
const nextWork = (k) => { do { k = addD(k, 1); } while (!isWork(k)); return k; };
const shiftWork = (k) => isWork(k) ? k : nextWork(k);
const weekDays = (k) => { const mo = addD(k, -wd(k)); return [0, 1, 2, 3, 4].map((i) => addD(mo, i)); };
const kw = (k) => { const d = P(k); d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7)); const w1 = new Date(d.getFullYear(), 0, 4); return 1 + Math.round(((d - w1) / 864e5 - 3 + ((w1.getDay() + 6) % 7)) / 7); };

/* ================= geography (km east / km north of the office in Offenbach) ================= */
const HOME = { id: 'home', name: 'Büro', ort: 'Offenbach', x: 0, y: 0 };
const kmB = (a, b) => Math.hypot(a.x - b.x, a.y - b.y) * 1.3; // road factor
const drv = (a, b) => { const k = kmB(a, b); return k < 0.5 ? 0 : Math.round(5 + k * 1.05); };
// the Main, from Aschaffenburg to Rüsselsheim (simplified)
const RIVER = [[29, -19], [26.4, -14.6], [23.5, -12.6], [20.4, -10.2], [17.4, -8.2], [15.2, -6.2], [15.4, -3.2], [14.2, -0.6], [11.6, 1.4], [8.2, 3.3], [4.8, 3.6], [2.2, 2.3], [0.3, 1.1], [-3.3, 1.1], [-6.2, 0.7], [-9.6, -1.1], [-13, -0.3], [-16.3, -0.4], [-19.6, -2.6], [-21.6, -5.6], [-24, -9.6], [-26, -12.2]];
const LANDMARKS = [{ name: 'Frankfurt', x: -6.6, y: 3.4 }];

/* ================= data ================= */
const KEY = 'plantafel.v1';
let S = null;
const SEED = [
  ['c1', 'Bäckerei Hofmann', 'Hofmann', 'Hanau', 10.8, 3.6, 14, 45, 9],
  ['c2', 'Autohaus Brenner', 'Brenner', 'Darmstadt', -8.3, -25.4, 28, 60, 36],
  ['c3', 'Metallbau Kessler', 'Kessler', 'Dieburg', 5.4, -22.5, 21, 60, 15],
  ['c4', 'Apotheke am Markt', 'Apotheke', 'Seligenstadt', 14.9, -6.3, 28, 30, 20],
  ['c5', 'Gasthof Linde', 'Linde', 'Gelnhausen', 30.1, 11.3, 42, 45, 51],
  ['c6', 'Schreinerei Vogt', 'Vogt', 'Friedberg', -0.8, 26.1, 21, 60, 17],
  ['c7', 'Elektro Adam', 'Adam', 'Bad Vilbel', -2.0, 8.9, 14, 45, 13],
  ['c8', 'Kfz-Service Yilmaz', 'Yilmaz', 'Rödermark', 4.5, -13.7, 21, 30, 18],
  ['c9', 'Druckerei Sommer', 'Sommer', 'Langen', -7.0, -12.3, 28, 45, 24],
  ['c10', 'Hotel Taunusblick', 'Taunusblick', 'Bad Homburg', -10.6, 13.9, 35, 60, 30],
  ['c11', 'Getränke Weber', 'Weber', 'Maintal', 5.3, 5.0, 14, 30, 11],
  ['c12', 'Praxis Dr. Albers', 'Albers', 'Neu-Isenburg', -5.1, -5.7, 28, 30, 26],
  ['c13', 'Baustoffe Krämer', 'Krämer', 'Aschaffenburg', 27.3, -13.7, 21, 60, 19],
  ['c14', 'Café Lindner', 'Lindner', 'Sachsenhausen', -6.0, -0.4, 21, 30, 20],
  ['c15', 'Gartenbau Roth', 'Roth', 'Rodgau', 8.5, -9.0, 35, 45, 30],
  ['c16', 'Fliesen Novak', 'Novak', 'Hofheim', -22.8, -1.2, 42, 60, 47],
  ['c17', 'Optik Schäfer', 'Schäfer', 'Mühlheim', 4.9, 1.8, 28, 30, 33],
  ['c18', 'Sanitär Becker', 'Becker', 'Obertshausen', 6.0, -3.3, 21, 45, 27]
];
function seed() {
  const T = today();
  S = { v: 1, demo: true, set: { start: 480, end: 1050 }, appts: [],
    cust: SEED.map(([id, name, short, ort, x, y, iv, dur, ago]) => ({ id, name, short, ort, x, y, iv, dur, last: addD(T, -ago) })) };
  const wds = []; let k = T; if (!isWork(k)) k = nextWork(k);
  while (wds.length < 8) { wds.push(k); k = nextWork(k); }
  const plan = [[0, 'c11'], [0, 'c1'], [0, 'c4'], [0, 'c18'], [0, 'c8'], [1, 'c7'], [1, 'c6', 780], [1, 'c10'], [2, 'c9'], [2, 'c12'], [2, 'c14'], [3, 'c13'], [6, 'c3']];
  plan.forEach(([w, c, fix], i) => S.appts.push({ id: uid(), c, d: wds[w], seq: i, start: null, dur: cust(c).dur, fix: fix ?? null, win: null }));
  [...new Set(S.appts.map((a) => a.d))].forEach((d) => reflowDay(d, { ignoreNow: true }));
  return S;
}
function load() { try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && s.v === 1) return s; } catch { /* fresh */ } return seed(); }
function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch { /* storage full or blocked */ } }
function ensure() { if (!S) { S = load(); save(); } }
const cust = (id) => S.cust.find((c) => c.id === id);
const dayList = (d) => S.appts.filter((a) => a.d === d).sort((a, b) => a.seq - b.seq);
const isDone = (a) => { const T = today(); return a.d < T || (a.d === T && a.start != null && a.start + a.dur <= nowMin()); };
const lastVisit = (c) => { let l = c.last; for (const a of S.appts) if (a.c === c.id && isDone(a) && a.d > l) l = a.d; return l; };
const since = (c) => diffD(lastVisit(c), today());
const due = (c) => since(c) / c.iv;
const hasFuture = (id) => S.appts.some((a) => a.c === id && !isDone(a));
let undoSnap = null; const snap = () => { undoSnap = JSON.stringify(S); };

/* ================= planning engine ================= */
function compute(day, list, o = {}) {
  const T = today(), now = nowMin(), st = S.set;
  const past = !o.ignoreNow && day < T, isT = !o.ignoreNow && day === T;
  let floor = st.start; if (isT) floor = Math.max(floor, ceil5(now + 20));
  let prev = HOME, t = null, km = 0, dr = 0, conf = 0, late = 0, winV = 0;
  const stops = [];
  for (const a of list) {
    const c = cust(a.c), dm = drv(prev, c), dk = kmB(prev, c);
    const frozen = past || (isT && a.start != null && a.start <= now);
    let start, lt = 0;
    if (frozen) start = a.start;
    else {
      let e = ceil5(t == null ? floor : Math.max(t + dm, floor));
      if (a.win === 'pm') e = Math.max(e, 780);
      if (a.fix != null) { if (e > a.fix) { lt = e - a.fix; conf++; late += lt; } start = a.fix; } else start = e;
      if (a.win === 'am' && start + a.dur > 750) winV++;
    }
    stops.push({ a, c, start, end: start + a.dur, dm, dk, frozen, late: lt });
    km += dk; dr += dm; t = start + a.dur; prev = c;
  }
  const hd = list.length ? drv(prev, HOME) : 0, hk = list.length ? kmB(prev, HOME) : 0;
  const home = t == null ? null : t + hd;
  return { stops, km: km + hk, dr: dr + hd, hd, hk, home, depart: stops.length ? stops[0].start - stops[0].dm : null,
    over: home == null ? 0 : Math.max(0, home - st.end), conf, late, winV };
}
const penalty = (r) => r.conf * 600 + r.late * 8 + r.over * 5 + r.winV * 300;
function reflowDay(d, o = {}) {
  if (!o.ignoreNow && d < today()) return;
  const list = dayList(d), r = compute(d, list, o);
  r.stops.forEach((s, k) => { if (!s.frozen) s.a.start = s.start; s.a.seq = k; });
}
function workDaysAhead(n) {
  const out = []; let k = today();
  if (!(isWork(k) && nowMin() < S.set.end - 60)) k = nextWork(k);
  while (out.length < n) { out.push(k); k = nextWork(k); }
  return out;
}
function evalInsert(d, list, i, tpl, base, di) {
  const na = { id: '', c: tpl.c, d: null, seq: 0, start: null, dur: tpl.dur, fix: tpl.fix ?? null, win: tpl.win || null };
  const l2 = [...list.slice(0, i), na, ...list.slice(i)];
  const r = compute(d, l2);
  const extra = r.dr - base.dr;
  const pen = penalty(r) - penalty(base) + (l2.length > 8 ? 200 : 0);
  const ns = r.stops[i];
  return { d, i, l2, na, r, extra, pen, di, start: ns.start, end: ns.end, prev: list[i - 1] || null, next: list[i] || null };
}
const minPos = (base) => { let m = 0; base.stops.forEach((s, i) => { if (s.frozen) m = i + 1; }); return m; };
function propose(cid, o = {}) {
  const c = cust(cid), dur = o.dur || c.dur, u = due(c);
  const days = o.days || workDaysAhead(10).filter((k) => k !== o.excludeDay);
  const T = today(), cands = [];
  days.forEach((d, di) => {
    if (d < T || (d === T && nowMin() > S.set.end - 60)) return;
    const list = dayList(d).filter((a) => a.id !== o.replace);
    const base = compute(d, list);
    for (let i = minPos(base); i <= list.length; i++) {
      const x = evalInsert(d, list, i, { c: cid, dur, fix: o.fix, win: o.win }, base, di);
      x.cost = x.extra + x.pen + di * (u > 1 ? 10 : 5);
      cands.push(x);
    }
  });
  cands.sort((a, b) => a.cost - b.cost);
  const res = [], seen = new Set();
  for (const x of cands) { if (res.length >= 3) break; if (days.length > 1 && seen.has(x.d)) continue; seen.add(x.d); res.push(x); }
  for (const x of cands) { if (res.length >= 3) break; if (!res.includes(x)) res.push(x); }
  return res;
}
function commitRaw(cand) {
  const na = cand.na; na.id = uid(); na.d = cand.d; S.appts.push(na);
  cand.l2.forEach((a, k) => { a.seq = k; }); reflowDay(cand.d);
}
function bestOrder(d) {
  if (d < today()) return null;
  const list = dayList(d), base = compute(d, list), mov = [];
  base.stops.forEach((s, i) => { if (!s.frozen && s.a.fix == null) mov.push(i); });
  if (mov.length < 3 || mov.length > 7) return null;
  const items = mov.map((i) => list[i]); let best = null;
  const test = (perm) => { const l2 = list.slice(); mov.forEach((p, k) => { l2[p] = perm[k]; }); const r = compute(d, l2); const cost = r.dr + penalty(r); if (!best || cost < best.cost) best = { cost, l2, r }; };
  const a = items.slice(), cc = new Array(a.length).fill(0); test(a.slice()); let i = 0;
  while (i < a.length) { if (cc[i] < i) { const j = i % 2 ? cc[i] : 0; [a[j], a[i]] = [a[i], a[j]]; test(a.slice()); cc[i]++; i = 0; } else { cc[i] = 0; i++; } }
  const saved = base.dr - best.r.dr, better = penalty(best.r) < penalty(base);
  if ((saved < 6 && !better) || penalty(best.r) > penalty(base)) return null;
  return { saved, better, l2: best.l2 };
}
function gaps(d, r) {
  const out = [], T = today(); if (d < T || !r.stops.length) return out;
  const st = S.set, floor = d === T ? Math.max(st.start, ceil5(nowMin() + 20)) : st.start, mp = minPos(r);
  r.stops.forEach((s, i) => {
    if (i < mp) return;
    const from = Math.max(i === 0 ? floor : r.stops[i - 1].end, floor), to = s.start - s.dm;
    if (to - from >= (i === 0 ? 60 : 45)) out.push({ i, from, to });
  });
  const last = r.stops[r.stops.length - 1], from = Math.max(last.end, floor), to = st.end - r.hd;
  if (r.stops.length >= mp && to - from >= 60) out.push({ i: r.stops.length, from, to });
  return out;
}
function gapCands(d, i) {
  const list = dayList(d), base = compute(d, list);
  return S.cust.filter((c) => !hasFuture(c.id) && due(c) >= 0.6).map((c) => {
    const x = evalInsert(d, list, i, { c: c.id, dur: c.dur }, base, 0); x.c = c; x.score = x.extra - due(c) * 30; return x;
  }).filter((x) => x.pen < 50).sort((a, b) => a.score - b.score).slice(0, 4);
}
function fillDays(k) {
  const T = today(); let ds = weekDays(k).filter((x) => x > T || (x === T && nowMin() < S.set.end - 60));
  if (!ds.length) ds = weekDays(addD(k, 7)); return ds;
}
function planFill(days, max = 8) {
  const before = JSON.stringify(S), added = [];
  const kmBefore = days.reduce((s, d) => s + compute(d, dayList(d)).km, 0);
  const cs = S.cust.filter((c) => !hasFuture(c.id) && due(c) >= 0.75).sort((a, b) => due(b) - due(a));
  for (const c of cs) {
    if (added.length >= max) break;
    const p = propose(c.id, { days })[0];
    if (!p || p.pen >= 50 || p.extra > 50) continue;
    commitRaw(p); added.push({ c, na: p.na });
  }
  const kmAfter = days.reduce((s, d) => s + compute(d, dayList(d)).km, 0);
  const rows = added.map((x) => ({ c: x.c, d: x.na.d, start: x.na.start })).sort((a, b) => a.d < b.d ? -1 : a.d > b.d ? 1 : a.start - b.start);
  const after = JSON.stringify(S); S = JSON.parse(before);
  return { rows, after, km: Math.round(kmAfter - kmBefore) };
}
function startDay() { const T = today(); return isWork(T) && nowMin() < S.set.end ? T : nextWork(T); }

/* ================= language understanding ================= */
const norm = (s) => s.toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss').replace(/[^a-z0-9]+/g, ' ').trim();
const STOP = new Set(('heute morgen uebermorgen montag dienstag mittwoch donnerstag freitag mo di mi do fr uhr um am bei beim termin besuch mit fuer ein eine einen ne stunde stunden std min minuten halbe halb anderthalb eineinhalb dreiviertel viertelstunde vormittag vormittags nachmittag nachmittags morgens frueh mittag mittags abends naechste naechsten naechster woche diese plan plane planen bitte noch zu und auf den dem der die das mal ich muss will zum zur nach vor in ab bis kunde kunden irgendwann dauert dauer etwa ca so gegen spaeter verschiebe verschieben verlege verlegen schiebe absagen sag sage ab streiche streichen loesche loeschen storniere stornieren entferne entfernen rein einplanen route').split(' '));
function lev(a, b) { if (Math.abs(a.length - b.length) > 1) return 9; const m = [...Array(b.length + 1).keys()]; for (let i = 1; i <= a.length; i++) { let p = m[0]; m[0] = i; for (let j = 1; j <= b.length; j++) { const t = m[j]; m[j] = Math.min(m[j] + 1, m[j - 1] + 1, p + (a[i - 1] === b[j - 1] ? 0 : 1)); p = t; } } return m[b.length]; }
function matchCustomers(text) {
  const toks = norm(text).split(' ').filter((t) => t.length >= 3 && !STOP.has(t) && !/^\d+$/.test(t));
  if (!toks.length) return [];
  return S.cust.map((c) => {
    let sc = 0;
    const words = [...norm(c.name).split(' ').map((w) => [w, 1]), ...norm(c.ort).split(' ').map((w) => [w, 0.5])].filter(([w]) => w.length >= 3);
    for (const [w, wt] of words) {
      let b = 0;
      for (const t of toks) {
        if (t === w) b = Math.max(b, w.length * 2);
        else if ((w.startsWith(t) && t.length >= 4) || (w.length >= 5 && t.startsWith(w.slice(0, 5)))) b = Math.max(b, Math.min(w.length, t.length));
        else if (t.length >= 5 && lev(t, w) <= 1) b = Math.max(b, w.length);
      }
      sc += b * wt;
    }
    return { c, sc };
  }).filter((x) => x.sc > 0).sort((a, b) => b.sc - a.sc);
}
function parse(raw) {
  const t = raw.toLowerCase().trim(), T = today();
  const o = { raw, kind: 'plan', cid: null, cands: [], days: null, dayLbl: null, fix: null, win: null, dur: null };
  if (/(absag|sag\w* .*\bab\b|streich|storn|lösch|loesch|entfern|cancel)/.test(t)) o.kind = 'cancel';
  else if (/(verschieb|verleg|schieb)/.test(t)) o.kind = 'move';
  else if (/(woche\s*(füllen|auffüllen|planen|voll)|\bfüll|auffüllen|plan\w* (meine|die) woche)/.test(t)) o.kind = 'fill';
  else if (/(route|reihenfolge|optimier)/.test(t)) o.kind = 'route';
  let m;
  if (/übermorgen|uebermorgen/.test(t)) o.days = [shiftWork(addD(T, 2))];
  else if (/\bmorgen\b/.test(t)) o.days = [shiftWork(addD(T, 1))];
  else if (/\bheute\b/.test(t)) o.days = [T];
  else if ((m = t.match(/\b(montag|dienstag|mittwoch|donnerstag|freitag|mo|di|mi|do|fr)\b/))) {
    const idx = ['mo', 'di', 'mi', 'do', 'fr'].indexOf(m[1].slice(0, 2));
    let k = /nächst|naechst/.test(t) ? addD(T, 1) : T;
    while (wd(k) !== idx || (k === T && nowMin() > S.set.end - 60)) k = addD(k, 1);
    o.days = [k];
  } else if (/(nächste|naechste) woche/.test(t)) { o.days = weekDays(addD(T, 7)); o.dayLbl = 'nächste Woche'; }
  else if (/diese woche/.test(t)) { o.days = fillDays(T); o.dayLbl = 'diese Woche'; }
  else if ((m = t.match(/(?<!um\s)\b(\d{1,2})\.(\d{1,2})\.?/))) {
    const dd = +m[1], mm = +m[2];
    if (mm >= 1 && mm <= 12 && dd >= 1 && dd <= 31) { const y = P(T).getFullYear(); let k = K(new Date(y, mm - 1, dd)); if (k < T) k = K(new Date(y + 1, mm - 1, dd)); o.days = [k]; }
  }
  if (o.days && !o.dayLbl) o.dayLbl = o.days.length === 1 ? shortLbl(o.days[0]) : o.days.length + ' Tage';
  m = t.match(/\bum\s+(\d{1,2})(?:[:.](\d{2}))?/) || t.match(/\b(\d{1,2}):(\d{2})\b/) || t.match(/\b(\d{1,2})(?:[:.](\d{2}))?\s*uhr\b/);
  if (m) { const hh = +m[1], mi = +(m[2] || 0); if (hh >= 6 && hh <= 20 && mi < 60) o.fix = hh * 60 + mi; }
  if (o.fix == null) { if (/vormittag|morgens|früh|frueh/.test(t)) o.win = 'am'; else if (/nachmittag|abends|mittags/.test(t)) o.win = 'pm'; }
  if ((m = t.match(/(\d+(?:[.,]\d+)?)\s*(h|std|stunden?)\b/))) o.dur = Math.round(parseFloat(m[1].replace(',', '.')) * 60);
  if ((m = t.match(/(\d+)\s*(min|minuten)\b/))) o.dur = +m[1];
  if (/viertelstunde/.test(t)) o.dur = 15;
  if (/halbe stunde/.test(t)) o.dur = 30;
  if (/dreiviertel/.test(t)) o.dur = 45;
  if (!o.dur && /\b(eine|ne)\s+stunde\b/.test(t)) o.dur = 60;
  if (/anderthalb|eineinhalb/.test(t)) o.dur = 90;
  if (/zwei stunden/.test(t)) o.dur = 120;
  if (o.dur) o.dur = Math.min(480, Math.max(15, o.dur));
  const mc = matchCustomers(t); o.cands = mc.slice(0, 5).map((x) => x.c);
  if (mc.length && (mc.length === 1 || mc[0].sc >= mc[1].sc * 1.3)) o.cid = mc[0].c.id;
  return o;
}

/* ================= AI line ================= */
// UI hooks are set by createPlantafel(); the board in the 3D office only reads the text.
let UI = {};
function insight(d) {
  const T = today();
  if (d < T) return { txt: 'Dieser Tag liegt hinter dir.', cls: 'calm' };
  const list = dayList(d), r = compute(d, list);
  const ls = r.stops.find((s) => s.late > 0);
  if (ls) {
    const i = r.stops.indexOf(ls), pv = r.stops.slice(0, i).reverse().find((s) => !s.frozen && s.a.fix == null);
    return { cls: 'warn', txt: ls.c.short + ' um ' + fm(ls.a.fix) + ' wird knapp, du wärst ' + ls.late + ' min zu spät.', act: 'Entzerren', fn: () => UI.openMove(pv ? pv.a : ls.a) };
  }
  if (r.over > 0) {
    const lst = r.stops.slice().reverse().find((s) => !s.frozen && s.a.fix == null);
    return { cls: 'warn', txt: 'Du bist erst ' + fm(r.home) + ' zurück, ' + r.over + ' min nach Feierabend.', act: lst ? 'Entlasten' : null, fn: () => lst && UI.openMove(lst.a) };
  }
  const bo = bestOrder(d);
  if (bo) return { txt: bo.saved >= 6 ? 'Andere Reihenfolge spart ' + bo.saved + ' min Fahrt.' : 'Andere Reihenfolge passt besser zu deinen Zeitfenstern.', act: 'Umstellen', fn: () => UI.applyOrder(d, bo) };
  const g = gaps(d, r)[0];
  if (g) { const c = gapCands(d, g.i)[0]; if (c) return { txt: 'Lücke ' + fm(g.from) + '–' + fm(g.to) + ': ' + c.c.short + ' ist fällig und liegt auf dem Weg.', act: 'Einplanen', fn: () => UI.commit(c) }; }
  const od = S.cust.filter((c) => !hasFuture(c.id) && due(c) > 1).length;
  if (od) return { txt: od + (od === 1 ? ' Kunde ist' : ' Kunden sind') + ' überfällig und noch nicht eingeplant.', act: 'Woche füllen', fn: () => UI.openFill(fillDays(d)) };
  return { txt: list.length ? 'Tag steht. Route und Zeiten passen.' : 'Alle Kunden sind im Rhythmus.', cls: 'calm' };
}

/** Summary of the next working day for the board in the 3D office. */
export function boardSnapshot() {
  ensure();
  const d = startDay(), list = dayList(d), r = compute(d, list), T = today(), now = nowMin(), dt = P(d);
  return {
    label: d === T ? 'Heute' : diffD(T, d) === 1 ? 'Morgen' : WDL[wd(d)],
    weekday: WDL[wd(d)],
    date: dt.getDate() + '. ' + MON[dt.getMonth()],
    kw: kw(d),
    meta: list.length ? list.length + (list.length === 1 ? ' Besuch' : ' Besuche') + ' · ' + Math.round(r.km) + ' km · zurück ' + fm(r.home) : 'Noch nichts geplant',
    depart: r.depart != null ? fm(r.depart) : null,
    home: r.home != null ? fm(r.home) : null,
    stops: r.stops.map((s) => ({ t: fm(s.start), name: s.c.name, ort: s.c.ort, done: isDone(s.a), cur: d === T && s.start <= now && now < s.end, fix: s.a.fix != null })),
    insight: insight(d).txt,
    warn: insight(d).cls === 'warn'
  };
}

/* ================= UI ================= */
const MARKUP = `
<div id="app">
  <header>
    <div class="top">
      <button class="back" id="back" aria-label="Zurück in die Spielewelt"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 6l-6 6 6 6"/></svg><span id="eb"></span></button>
      <div class="tr">
        <div class="seg" role="tablist" aria-label="Ansicht"><button id="vPlan" role="tab">Plan</button><button id="vMap" role="tab">Karte</button></div>
        <button class="icon-btn" id="gear" aria-label="Einstellungen"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/></svg></button>
      </div>
    </div>
    <button id="dayTitle" aria-label="Zum aktuellen Tag"><span class="dname" id="dname"></span><span class="ddate" id="ddate"></span></button>
    <div id="stats"></div>
    <div class="week" id="week"></div>
  </header>
  <div id="ins"></div>
  <main id="view"></main>
  <div id="dock">
    <div id="toast" role="status"></div>
    <div id="hint"></div>
    <form id="cmd" autocomplete="off">
      <div class="field">
        <input id="q" type="text" enterkeyhint="send" autocomplete="off" autocorrect="off" spellcheck="false" aria-label="Wen, wann?">
        <button type="submit" id="send" aria-label="Planen" hidden><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M6 11l6-6 6 6"/></svg></button>
      </div>
      <button type="button" id="mic" aria-label="Sprechen"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg></button>
    </form>
  </div>
</div>
<div id="sheet" hidden><div class="scrim"></div><div class="panel" id="panel"><div class="grab"></div><div class="sc" id="sc"></div></div></div>`;

/**
 * @param {{onExit?:Function}} hooks
 * @returns {{host:HTMLElement, mount:Function, unmount:Function, resize:Function}}
 */
export function createPlantafel(hooks = {}) {
  ensureFonts();
  ensure();
  const host = document.createElement('div');
  host.className = 'plantafel-host';
  const root = host.attachShadow({ mode: 'open' });
  root.innerHTML = '<style>' + css + '</style>' + MARKUP;
  const $ = (s) => root.querySelector(s);
  const view = $('#view');

  let mode = 'plan';
  try { mode = localStorage.getItem('plantafel.mode') === 'map' ? 'map' : 'plan'; } catch { /* default */ }
  const V = { day: startDay(), flash: null };
  const timers = [];

  /* ---------- render ---------- */
  function render() { renderHeader(); renderInsight(); if (mode === 'map') renderMap(); else renderThread(); renderHint(); }
  function renderHeader() {
    const d = V.day, dt = P(d), n = diffD(today(), d);
    $('#eb').textContent = 'Spielewelt';
    $('#vPlan').classList.toggle('on', mode === 'plan');
    $('#vMap').classList.toggle('on', mode === 'map');
    $('#vPlan').setAttribute('aria-selected', mode === 'plan');
    $('#vMap').setAttribute('aria-selected', mode === 'map');
    $('#dname').textContent = n === 0 ? 'Heute' : n === 1 ? 'Morgen' : WDL[wd(d)];
    $('#ddate').textContent = (n <= 1 && n >= 0 ? WD[wd(d)] + ', ' : '') + dt.getDate() + '. ' + MON[dt.getMonth()] + ' · KW ' + kw(d);
    const list = dayList(d), r = compute(d, list);
    $('#stats').textContent = !list.length ? 'Noch nichts geplant'
      : list.length + (list.length === 1 ? ' Besuch' : ' Besuche') + ' · ' + Math.round(r.km) + ' km · ' + dl(r.dr) + ' Fahrt · zurück ' + fm(r.home);
    const T = today(), cap = S.set.end - S.set.start;
    $('#week').innerHTML = '<button class="wk-nav" data-w="-7" aria-label="Vorige Woche">‹</button>' + weekDays(d).map((k) => {
      const l = dayList(k), rr = compute(k, l), ld = l.length ? Math.min(100, Math.round((rr.home - rr.depart) / cap * 100)) : 0;
      return '<button class="wk' + (k === d ? ' sel' : '') + (k === T ? ' today' : '') + (k < T ? ' past' : '') + (rr.over > 0 ? ' over' : '') + '" data-d="' + k + '"><span class="wd">' + WD[wd(k)] + '</span><span class="dn">' + P(k).getDate() + '</span><span class="bar"><i style="width:' + ld + '%"></i></span></button>';
    }).join('') + '<button class="wk-nav" data-w="7" aria-label="Nächste Woche">›</button>';
  }
  let insFn = null;
  function renderInsight() {
    const x = insight(V.day); insFn = x.fn || null; const el = $('#ins');
    el.className = x.cls || '';
    el.innerHTML = '<span class="spark"></span><p>' + esc(x.txt) + '</p>' + (x.act ? '<button id="insAct">' + esc(x.act) + '</button>' : '');
  }
  function emptyDay() {
    const d = V.day, T = today();
    const n = S.cust.filter((c) => !hasFuture(c.id) && due(c) >= 0.75).length, canFill = d >= T && !(d === T && nowMin() > S.set.end - 60);
    return { n, canFill };
  }
  function renderThread() {
    view.className = '';
    const d = V.day, list = dayList(d), T = today(), now = nowMin();
    if (!list.length) {
      const { n, canFill } = emptyDay();
      view.innerHTML = '<div class="empty"><p class="big">Noch frei.</p><p>' + (canFill ? (n ? n + ' Kunden sind bald fällig. Sag einfach, wen du sehen willst, oder lass den Tag füllen.' : 'Sag oder tipp, wen du sehen willst.') : 'An diesem Tag lässt sich nichts mehr planen.') + '</p>' + (canFill && n ? '<button class="primary" id="fillDay" style="width:auto;padding:0 22px">Tag füllen</button>' : '') + '</div>';
      return;
    }
    const r = compute(d, list), gp = gaps(d, r); let h = '';
    const gapRow = (g) => {
      const mins = g.to - g.from, lbl = g.i === 0 ? 'Frei bis ' + fm(g.to) : g.i === r.stops.length ? 'Frei ab ' + fm(g.from) : dl(mins) + ' frei';
      return '<button class="r gap" data-gi="' + g.i + '"><span class="tm">' + fm(g.from) + '</span><span class="rail"></span><span class="bd"><span>' + lbl + '</span><span class="gf">Füllen</span></span></button>';
    };
    const g0 = gp.find((g) => g.i === 0); if (g0) h += gapRow(g0);
    const allDone = r.stops[0] && isDone(r.stops[0].a);
    h += '<div class="r end first' + (allDone ? ' dim' : '') + '"><span class="tm">' + fm(r.depart) + '</span><span class="rail"><i class="bead"></i></span><span class="bd">Abfahrt · ' + HOME.name + ' ' + HOME.ort + '</span></div>';
    r.stops.forEach((s, i) => {
      const g = gp.find((x) => x.i === i && i > 0); if (g) h += gapRow(g);
      const done = isDone(s.a), cur = d === T && s.start <= now && now < s.end;
      h += '<div class="r drive' + (done ? ' dim' : '') + '"><span class="tm"></span><span class="rail"></span><span class="bd">' + s.dm + ' min · ' + Math.round(s.dk) + ' km</span></div>';
      const tags = [esc(s.c.ort), dl(s.a.dur)];
      if (s.a.fix != null) tags.push('fix');
      if (s.a.win === 'am') tags.push('vormittags'); if (s.a.win === 'pm') tags.push('nachmittags');
      if (s.late) tags.push('<span class="w">' + s.late + ' min zu spät</span>');
      h += '<button class="r stop' + (done ? ' done dim' : '') + (cur ? ' cur' : '') + (s.a.fix != null ? ' fix' : '') + (s.late ? ' late' : '') + (V.flash === s.a.id ? ' flash' : '') + '" data-id="' + s.a.id + '"><span class="tm">' + fm(s.start) + '</span><span class="rail"><i class="bead"></i></span><span class="bd"><b>' + esc(s.c.name) + '</b><small>' + tags.join(' · ') + '</small></span></button>';
    });
    const ge = gp.find((g) => g.i === r.stops.length); if (ge) h += gapRow(ge);
    const lastDone = isDone(r.stops[r.stops.length - 1].a);
    h += '<div class="r drive' + (lastDone ? ' dim' : '') + '"><span class="tm"></span><span class="rail"></span><span class="bd">' + r.hd + ' min · ' + Math.round(r.hk) + ' km</span></div>';
    h += '<div class="r end last' + (lastDone ? ' dim' : '') + '"><span class="tm">' + fm(r.home) + '</span><span class="rail"><i class="bead"></i></span><span class="bd">Zurück' + (r.over ? ' · <span style="color:var(--warn)">' + r.over + ' min Überzeit</span>' : '') + '</span></div>';
    view.innerHTML = h;
    if (V.flash) { const el = view.querySelector('.flash'); if (el) el.scrollIntoView({ block: 'center', behavior: 'smooth' }); V.flash = null; }
  }

  /* ---------- map: the day's thread laid onto the region ---------- */
  function renderMap() {
    view.className = 'map';
    const d = V.day, list = dayList(d), T = today(), now = nowMin();
    const r = compute(d, list);
    const W = Math.max(280, view.clientWidth || 360), H = Math.max(240, view.clientHeight || 420);
    const planDay = d >= T && !(d === T && now > S.set.end - 60);
    // due customers that are not planned yet: shown as dashed rings, tap = plan into this day
    const dues = planDay ? S.cust.filter((c) => !hasFuture(c.id) && due(c) >= 0.6) : [];
    // bounds: the route; without a route, the whole region
    let pts = r.stops.length ? [HOME, ...r.stops.map((s) => s.c)] : [HOME, ...S.cust];
    let x0 = Math.min(...pts.map((p) => p.x)), x1 = Math.max(...pts.map((p) => p.x));
    let y0 = Math.min(...pts.map((p) => p.y)), y1 = Math.max(...pts.map((p) => p.y));
    const minSpan = 16;
    if (x1 - x0 < minSpan) { const c = (x0 + x1) / 2; x0 = c - minSpan / 2; x1 = c + minSpan / 2; }
    if (y1 - y0 < minSpan) { const c = (y0 + y1) / 2; y0 = c - minSpan / 2; y1 = c + minSpan / 2; }
    const padL = 34, padR = 34, padT = 36, padB = 70;
    const sc = Math.min((W - padL - padR) / (x1 - x0), (H - padT - padB) / (y1 - y0));
    const ox = padL + ((W - padL - padR) - (x1 - x0) * sc) / 2, oy = padT + ((H - padT - padB) - (y1 - y0) * sc) / 2;
    const X = (x) => ox + (x - x0) * sc, Y = (y) => oy + (y1 - y) * sc;
    const inView = (p) => X(p.x) > 8 && X(p.x) < W - 8 && Y(p.y) > 8 && Y(p.y) < H - 64;

    // label placement with simple collision avoidance
    const boxes = [];
    const hits = (b) => boxes.some((o) => b.x < o.x + o.w && b.x + b.w > o.x && b.y < o.y + o.h && b.y + b.h > o.y);
    const tw = (s, px) => s.length * px;
    function place(cx, cy, w, h, rad, prefer) {
      const opts = {
        r: { x: cx + rad + 6, y: cy - h / 2 }, l: { x: cx - rad - 6 - w, y: cy - h / 2 },
        b: { x: cx - w / 2, y: cy + rad + 4 }, t: { x: cx - w / 2, y: cy - rad - 4 - h }
      };
      const order = prefer === 'l' ? ['l', 'r', 'b', 't'] : ['r', 'l', 'b', 't'];
      for (const k of order) {
        const b = { ...opts[k], w, h };
        if (b.x < 4 || b.x + w > W - 4 || b.y < 4 || b.y + h > H - 50) continue;
        if (!hits(b)) { boxes.push(b); return b; }
      }
      return null;
    }

    let svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Tagesroute auf der Karte">';
    svg += '<rect class="m-land" x="0" y="0" width="' + W + '" height="' + H + '"/>';
    // river (smoothed)
    const rp = RIVER.map(([x, y]) => [X(x), Y(y)]);
    let path = 'M' + rp[0][0].toFixed(1) + ' ' + rp[0][1].toFixed(1);
    for (let i = 1; i < rp.length - 1; i++) { const mx = (rp[i][0] + rp[i + 1][0]) / 2, my = (rp[i][1] + rp[i + 1][1]) / 2; path += ' Q' + rp[i][0].toFixed(1) + ' ' + rp[i][1].toFixed(1) + ' ' + mx.toFixed(1) + ' ' + my.toFixed(1); }
    path += ' L' + rp[rp.length - 1][0].toFixed(1) + ' ' + rp[rp.length - 1][1].toFixed(1);
    svg += '<path class="m-water" d="' + path + '"/>';

    // reserve space for beads first so town names do not sit on them
    const beadPos = [];
    r.stops.forEach((s, i) => {
      let bx = X(s.c.x), by = Y(s.c.y);
      for (const p of beadPos) if (Math.hypot(p.x - bx, p.y - by) < 22) { bx += 18; by += 14; }
      beadPos.push({ x: bx, y: by, s, i });
      boxes.push({ x: bx - 13, y: by - 13, w: 26, h: 26 });
    });
    const hx = X(HOME.x), hy = Y(HOME.y);
    boxes.push({ x: hx - 7, y: hy - 7, w: 14, h: 14 });

    // routes
    if (r.stops.length) {
      const seq = [{ x: hx, y: hy }, ...beadPos, { x: hx, y: hy }];
      const T0 = d === T;
      for (let i = 0; i < seq.length - 1; i++) {
        const a = seq[i], b = seq[i + 1];
        const toStop = r.stops[i];
        const isHome = i === seq.length - 2;
        const done = toStop ? isDone(toStop.a) && T0 || d < T : d < T || (T0 && isDone(r.stops[r.stops.length - 1].a) && now >= r.home);
        svg += '<path class="m-route' + (done ? ' done' : '') + (isHome ? ' home' : '') + '" d="M' + a.x.toFixed(1) + ' ' + a.y.toFixed(1) + ' L' + b.x.toFixed(1) + ' ' + b.y.toFixed(1) + '"/>';
      }
      // drive minutes on longer legs
      for (let i = 0; i < seq.length - 1; i++) {
        const a = seq[i], b = seq[i + 1], len = Math.hypot(b.x - a.x, b.y - a.y);
        if (len < 70) continue;
        const mins = i < r.stops.length ? r.stops[i].dm : r.hd, txt = mins + '′';
        const w = tw(txt, 6.4) + 8, hh = 15, mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
        const bx = { x: mx - w / 2, y: my - hh / 2, w, h: hh };
        if (hits(bx)) continue;
        boxes.push(bx);
        svg += '<rect class="m-dm-bg" x="' + bx.x.toFixed(1) + '" y="' + bx.y.toFixed(1) + '" width="' + w.toFixed(1) + '" height="' + hh + '" rx="7"/><text class="m-dm" x="' + mx.toFixed(1) + '" y="' + (my + 3.5).toFixed(1) + '" text-anchor="middle">' + txt + '</text>';
      }
    }

    // home
    svg += '<rect class="m-home" x="' + (hx - 6).toFixed(1) + '" y="' + (hy - 6).toFixed(1) + '" width="12" height="12" rx="2"/>';
    const hl = place(hx, hy, tw('BÜRO', 7.2) + 2, 13, 7, hx > W * 0.6 ? 'l' : 'r');
    if (hl) svg += '<text class="m-home-l" x="' + hl.x.toFixed(1) + '" y="' + (hl.y + 10).toFixed(1) + '">BÜRO</text>';

    // stops
    let gl = '';
    beadPos.forEach(({ x, y, s, i }) => {
      const done = isDone(s.a), cur = d === T && s.start <= now && now < s.end;
      const cls = 'm-stop' + (done ? ' done' : '') + (cur ? ' cur' : '') + (s.late ? ' late' : '');
      const shape = s.a.fix != null
        ? '<rect class="m-bead" x="' + (x - 11).toFixed(1) + '" y="' + (y - 11).toFixed(1) + '" width="22" height="22" rx="5"/>'
        : '<circle class="m-bead" cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="11"/>';
      const tt = fm(s.start), nm = s.c.short;
      const w = Math.max(tw(tt, 6.7), tw(nm, 7.6)) + 8, hh = 32;
      const lb = place(x, y, w, hh, 12, x > W * 0.62 ? 'l' : 'r');
      let lbl = '';
      if (lb) {
        const right = lb.x > x;
        const tx = right ? lb.x + 4 : lb.x + w - 4, anchor = right ? 'start' : 'end';
        if (lb.y > y + 8 || lb.y + hh < y - 8) { // above/below: centred
          lbl = '<rect class="m-lbg" x="' + lb.x.toFixed(1) + '" y="' + lb.y.toFixed(1) + '" width="' + w.toFixed(1) + '" height="' + hh + '" rx="6"/>' +
            '<text class="m-lt" x="' + (lb.x + w / 2).toFixed(1) + '" y="' + (lb.y + 12).toFixed(1) + '" text-anchor="middle">' + tt + '</text>' +
            '<text class="m-ln" x="' + (lb.x + w / 2).toFixed(1) + '" y="' + (lb.y + 27).toFixed(1) + '" text-anchor="middle">' + esc(nm) + '</text>';
        } else {
          lbl = '<rect class="m-lbg" x="' + lb.x.toFixed(1) + '" y="' + lb.y.toFixed(1) + '" width="' + w.toFixed(1) + '" height="' + hh + '" rx="6"/>' +
            '<text class="m-lt" x="' + tx.toFixed(1) + '" y="' + (lb.y + 12).toFixed(1) + '" text-anchor="' + anchor + '">' + tt + '</text>' +
            '<text class="m-ln" x="' + tx.toFixed(1) + '" y="' + (lb.y + 27).toFixed(1) + '" text-anchor="' + anchor + '">' + esc(nm) + '</text>';
        }
      }
      gl += '<g class="' + cls + '" data-id="' + s.a.id + '">' + (cur ? '<circle class="m-halo" cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="19"/>' : '') + shape +
        '<text class="m-num" x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '">' + (i + 1) + '</text>' + lbl +
        '<circle class="m-hit" cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="22"/></g>';
    });

    // due customers nearby
    let dg = '', dueShown = 0;
    dues.filter(inView).forEach((c) => {
      const x = X(c.x), y = Y(c.y);
      if (boxes.some((b) => x > b.x - 4 && x < b.x + b.w + 4 && y > b.y - 4 && y < b.y + b.h + 4)) return;
      boxes.push({ x: x - 8, y: y - 8, w: 16, h: 16 });
      const lb = place(x, y, tw(c.short, 6.8) + 2, 14, 7, x > W * 0.62 ? 'l' : 'r');
      dueShown++;
      dg += '<g class="m-dueg" data-due="' + c.id + '"><circle class="m-due" cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="7"/>' +
        (lb ? '<text class="m-due-l" x="' + (lb.x + (lb.x > x ? 0 : lb.w)).toFixed(1) + '" y="' + (lb.y + 11).toFixed(1) + '" text-anchor="' + (lb.x > x ? 'start' : 'end') + '">' + esc(c.short) + '</text>' : '') +
        '<circle class="m-hit" cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="20"/></g>';
    });

    // town names for orientation (customers that are neither on the route nor due)
    let tg = '';
    const shown = new Set([...r.stops.map((s) => s.c.ort), HOME.ort]);
    const towns = [...S.cust.filter((c) => !shown.has(c.ort) && !(dues.includes(c))).map((c) => ({ name: c.ort, x: c.x, y: c.y })), ...LANDMARKS];
    towns.filter(inView).forEach((t) => {
      const x = X(t.x), y = Y(t.y);
      if (boxes.some((b) => x > b.x - 2 && x < b.x + b.w + 2 && y > b.y - 2 && y < b.y + b.h + 2)) return;
      const lb = place(x, y, tw(t.name, 6) + 2, 12, 3, x > W * 0.62 ? 'l' : 'r');
      if (!lb) return;
      tg += '<circle class="m-town" cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="2.4"/><text class="m-town-l" x="' + (lb.x + (lb.x > x ? 0 : lb.w)).toFixed(1) + '" y="' + (lb.y + 9.5).toFixed(1) + '" text-anchor="' + (lb.x > x ? 'start' : 'end') + '">' + esc(t.name) + '</text>';
    });

    // river name last, only where it is free
    let wl = '';
    for (const [rx, ry] of RIVER) {
      const x = X(rx), y = Y(ry) + 8, b = { x, y, w: 34, h: 12 };
      if (x < W * 0.12 || x > W * 0.8 || y < 20 || y > H - 70 || hits(b)) continue;
      wl = '<text class="m-water-l" x="' + x.toFixed(0) + '" y="' + (y + 10).toFixed(0) + '">MAIN</text>'; break;
    }
    svg += wl + tg + dg + gl + '</svg>';

    // bottom bar: legend + route hand-off
    const open = r.stops.filter((s) => !isDone(s.a));
    let bar = '<div class="mbar">';
    bar += dueShown ? '<span class="mleg"><i></i>Fällig · antippen</span>' : '<span></span>';
    if (open.length && d >= T) {
      const q = (s) => encodeURIComponent(s.c.ort);
      const url = 'https://www.google.com/maps/dir/?api=1&travelmode=driving&origin=' + encodeURIComponent(HOME.ort) +
        '&destination=' + encodeURIComponent(HOME.ort) + '&waypoints=' + open.map(q).join('%7C');
      bar += '<a class="pill" href="' + url + '" target="_blank" rel="noopener">Route starten<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17L17 7M9 7h8v8"/></svg></a>';
    }
    bar += '</div>';
    let empty = '';
    if (!list.length) {
      const { n, canFill } = emptyDay();
      empty = '<div class="mempty">' + (canFill ? (n ? 'Noch frei. Tippe einen fälligen Kunden an.' : 'Noch frei.') : 'An diesem Tag lässt sich nichts mehr planen.') + '</div>';
    }
    view.innerHTML = svg + empty + bar;
    V.flash = null;
  }

  const L = 43.98;
  const ring = (f) => '<svg class="ring' + (f > 1 ? ' over' : '') + '" width="18" height="18" viewBox="0 0 18 18"><circle class="bg" cx="9" cy="9" r="7" fill="none" stroke-width="2"/><circle class="fg" cx="9" cy="9" r="7" fill="none" stroke-width="2" stroke-linecap="round" stroke-dasharray="' + (L * Math.min(1, f)).toFixed(1) + ' ' + L + '" transform="rotate(-90 9 9)"/></svg>';
  function renderHint() {
    const v = $('#q').value.trim(); $('#send').hidden = !v;
    if (v) {
      const p = parse(v), kl = { plan: 'Einplanen', cancel: 'Absagen', move: 'Verschieben', fill: 'Woche füllen', route: 'Route optimieren' }[p.kind];
      let h = '<div class="parse"><span>' + kl + '</span>';
      if (p.kind !== 'fill' && p.kind !== 'route') h += p.cid ? '<b>' + esc(cust(p.cid).short) + '</b>' : '<span class="miss">' + (p.cands.length > 1 ? 'Wer genau?' : 'Kunde?') + '</span>';
      if (p.dayLbl) h += '<span>' + p.dayLbl + '</span>';
      if (p.fix != null) h += '<span>' + fm(p.fix) + '</span>';
      if (p.win) h += '<span>' + (p.win === 'am' ? 'vormittags' : 'nachmittags') + '</span>';
      if (p.dur) h += '<span>' + dl(p.dur) + '</span>';
      $('#hint').innerHTML = h + '</div>'; return;
    }
    const list = S.cust.filter((c) => !hasFuture(c.id)).map((c) => ({ c, f: due(c) })).filter((x) => x.f >= 0.6).sort((a, b) => b.f - a.f).slice(0, 8);
    $('#hint').innerHTML = '<div class="chips"><span class="lab">FÄLLIG</span>' + list.map((x) => '<button class="chip" data-c="' + x.c.id + '">' + ring(x.f) + esc(x.c.short) + '<em>' + since(x.c) + ' T</em></button>').join('') + '<button class="chip all" id="allC">Alle</button></div>';
  }

  /* ---------- toast ---------- */
  let tt = null;
  function toast(msg, undo) {
    const el = $('#toast'); el.innerHTML = '<span>' + esc(msg) + '</span>' + (undo && undoSnap ? '<button id="undo">Rückgängig</button>' : '');
    el.classList.add('on'); clearTimeout(tt); tt = setTimeout(() => el.classList.remove('on'), 4800);
  }
  $('#toast').addEventListener('click', (e) => { if (e.target.id === 'undo' && undoSnap) { S = JSON.parse(undoSnap); undoSnap = null; save(); render(); $('#toast').classList.remove('on'); } });

  /* ---------- sheets ---------- */
  const sheet = $('#sheet'), sc = $('#sc'); let sheetFns = {};
  function openSheet(html, fns = {}) { sc.innerHTML = html; sheetFns = fns; sheet.hidden = false; $('#panel').scrollTop = 0; requestAnimationFrame(() => requestAnimationFrame(() => sheet.classList.add('on'))); }
  function closeSheet() { if (sheet.hidden) return; sheet.classList.remove('on'); setTimeout(() => { if (!sheet.classList.contains('on')) sheet.hidden = true; }, 260); }
  sheet.querySelector('.scrim').addEventListener('click', closeSheet);
  sc.addEventListener('click', (e) => { const b = e.target.closest('[data-f]'); if (b && sheetFns[b.dataset.f]) sheetFns[b.dataset.f](b); });
  sc.addEventListener('input', (e) => { if (sheetFns.input) sheetFns.input(e); });
  sc.addEventListener('change', (e) => { if (sheetFns.change) sheetFns.change(e); });
  { let y0 = null; const pn = $('#panel');
    pn.addEventListener('touchstart', (e) => { y0 = pn.scrollTop <= 0 ? e.touches[0].clientY : null; }, { passive: true });
    pn.addEventListener('touchend', (e) => { if (y0 != null && e.changedTouches[0].clientY - y0 > 90) closeSheet(); y0 = null; }); }

  function commit(cand, o = {}) {
    snap();
    let oldDay = null;
    if (o.replace) { const old = S.appts.find((a) => a.id === o.replace); oldDay = old && old.d; S.appts = S.appts.filter((a) => a.id !== o.replace); }
    commitRaw(cand);
    if (oldDay && oldDay !== cand.d) reflowDay(oldDay);
    save(); V.day = cand.d; V.flash = cand.na.id; closeSheet(); render();
    toast((o.replace ? 'Verschoben' : 'Eingeplant') + ' · ' + shortLbl(cand.d) + ' ' + fm(cand.na.start), true);
  }
  function why(x) {
    const p = [];
    if (x.prev && x.next) p.push('zwischen ' + esc(cust(x.prev.c).ort) + ' und ' + esc(cust(x.next.c).ort));
    else if (x.prev) p.push('nach ' + esc(cust(x.prev.c).short));
    else if (x.next) p.push('vor ' + esc(cust(x.next.c).short));
    else p.push('eigene Tour');
    p.push('+' + x.extra + ' min Fahrt');
    if (x.r.over > 0) p.push('<span class="w">' + x.r.over + ' min Überzeit</span>');
    if (x.r.conf > 0) p.push('<span class="w">Fixtermin wird knapp</span>');
    if (x.r.winV > 0) p.push('<span class="w">Zeitfenster nicht ideal</span>');
    return p.join(' · ');
  }
  const lastTxt = (c) => { const n = since(c); return n === 0 ? 'heute besucht' : n === 1 ? 'gestern besucht' : 'zuletzt vor ' + n + ' Tagen'; };
  function openPropose(cid, o = {}) {
    const c = cust(cid), props = propose(cid, o);
    const head = '<div class="eb">' + (o.replace ? 'Neuer Platz' : 'Vorschlag') + '</div><h2>' + esc(c.name) + '</h2><div class="sub">' + esc(c.ort) + ' · ' + dl(o.dur || c.dur) + ' · ' + lastTxt(c) + ' · alle ' + c.iv + ' Tage</div>';
    const dayRow = '<div class="eb" style="margin-top:4px">Anderer Tag</div><div class="daychips">' + workDaysAhead(8).map((k) => '<button data-f="day" data-d="' + k + '">' + shortLbl(k) + '</button>').join('') + '</div>';
    const fns = { day: (b) => openPropose(cid, { ...o, days: [b.dataset.d] }) };
    if (!props.length) { openSheet(head + '<p class="note">An diesem Tag ist kein Platz mehr frei.</p>' + dayRow, fns); return; }
    const b = props[0];
    props.forEach((x, i) => { fns['p' + i] = () => commit(x, { replace: o.replace }); });
    openSheet(head +
      (b.pen >= 500 ? '<p class="note" style="color:var(--warn)">Konfliktfrei geht es nicht. Das ist der beste Kompromiss.</p>' : '') +
      '<div class="best"><div class="when">' + (shortLbl(b.d).length < 8 ? shortLbl(b.d) : WDL[wd(b.d)] + ', ' + P(b.d).getDate() + '. ' + MON[P(b.d).getMonth()]) + '</div><div class="time">' + fm(b.start) + ' – ' + fm(b.end) + '</div><div class="why">' + why(b) + '</div>' +
      '<button class="primary" data-f="p0">' + (o.replace ? 'Hierhin verschieben' : 'Einplanen') + '</button></div>' +
      (props.length > 1 ? '<div class="list">' + props.slice(1).map((x, i) => '<button class="li" data-f="p' + (i + 1) + '"><span class="l"><b>' + shortLbl(x.d) + ' · ' + fm(x.start) + '</b><small>' + why(x) + '</small></span><span class="go">Nehmen</span></button>').join('') + '</div>' : '') +
      dayRow, fns);
  }
  function openMove(a) { openPropose(a.c, { dur: a.dur, win: a.win, replace: a.id, excludeDay: a.d }); }
  function openStop(id) {
    const a = S.appts.find((x) => x.id === id); if (!a) return;
    const c = cust(a.c), r = compute(a.d, dayList(a.d)), s = r.stops.find((x) => x.a === a), done = isDone(a);
    const nav = '<a class="act full" href="https://maps.apple.com/?daddr=' + encodeURIComponent(c.ort) + '" target="_blank" rel="noopener">Navigation nach ' + esc(c.ort) + '</a>';
    const head = '<div class="eb">' + shortLbl(a.d) + ' · ' + fm(s.start) + '–' + fm(s.end) + (a.fix != null ? ' · fix' : '') + '</div><h2>' + esc(c.name) + '</h2><div class="sub">' + esc(c.ort) + ' · alle ' + c.iv + ' Tage</div>';
    const mut = (fn, msg) => () => { snap(); fn(); reflowDay(a.d); save(); closeSheet(); render(); toast(msg, true); };
    if (done) {
      openSheet(head + '<p class="note">Vergangene Termine zählen automatisch als erledigt. Hat er nicht stattgefunden, plane ich ihn neu.</p><div class="acts"><button class="act full danger" data-f="miss">Hat nicht stattgefunden</button></div>',
        { miss: () => { snap(); S.appts = S.appts.filter((x) => x !== a); save(); render(); openPropose(c.id); } });
      return;
    }
    openSheet(head + '<div class="acts">' +
      '<button class="act" data-f="m15">−15 min</button><button class="act" data-f="p15">+15 min</button>' +
      '<button class="act" data-f="move">Verschieben</button><button class="act" data-f="fix">' + (a.fix != null ? 'Fixzeit lösen' : 'Fix um ' + fm(s.start)) + '</button>' +
      nav + '<button class="act full danger" data-f="del">Absagen</button></div>', {
      m15: mut(() => { a.dur = Math.max(15, a.dur - 15); }, 'Kürzer · Folgetermine rücken vor'),
      p15: mut(() => { a.dur += 15; }, 'Länger · Folgetermine rücken nach'),
      move: () => openMove(a),
      fix: mut(() => { a.fix = a.fix != null ? null : s.start; }, a.fix != null ? 'Zeit ist wieder flexibel' : 'Fixiert um ' + fm(s.start)),
      del: () => { snap(); const d = a.d; S.appts = S.appts.filter((x) => x !== a); reflowDay(d); save(); closeSheet(); render(); toast(c.short + ' abgesagt', true); }
    });
  }
  function openGap(i) {
    const d = V.day, r = compute(d, dayList(d)), g = gaps(d, r).find((x) => x.i === i); if (!g) return;
    const cs = gapCands(d, i), fns = {}; cs.forEach((x, k) => { fns['g' + k] = () => commit(x); });
    openSheet('<div class="eb">' + shortLbl(d) + ' · ' + fm(g.from) + '–' + fm(g.to) + '</div><h2>Wer passt in die Lücke?</h2><div class="sub">Sortiert nach Fälligkeit und Umweg</div>' +
      (cs.length ? '<div class="list">' + cs.map((x, k) => '<button class="li" data-f="g' + k + '"><span class="l"><b>' + esc(x.c.name) + '</b><small>' + esc(x.c.ort) + ' · ' + lastTxt(x.c) + ' · +' + x.extra + ' min Fahrt</small></span><span class="r2">' + fm(x.start) + '</span></button>').join('') + '</div>' : '<p class="note">Kein fälliger Kunde passt ohne großen Umweg in diese Lücke.</p>') +
      '<button class="secondary" data-f="all">Anderen Kunden wählen</button>', { ...fns, all: () => openAll() });
  }
  function openAll(o = {}) {
    const rows = (q) => { const nq = norm(q || ''); return S.cust.filter((c) => !nq || norm(c.name + ' ' + c.ort).includes(nq)).sort((a, b) => due(b) - due(a)).map((c) => '<button class="li" data-f="c" data-c="' + c.id + '"><span class="l"><b>' + esc(c.name) + '</b><small>' + esc(c.ort) + ' · ' + lastTxt(c) + (hasFuture(c.id) ? ' · geplant' : '') + '</small></span>' + ring(due(c)) + '</button>').join(''); };
    openSheet('<div class="eb">' + (o.title ? 'Nicht eindeutig' : 'Kunden') + '</div><h2>' + (o.title || 'Wen möchtest du sehen?') + '</h2><input class="search" id="cs" type="search" placeholder="Name oder Ort" value="' + esc(o.q || '') + '"><div class="list" id="cl">' + (o.cands && o.cands.length ? o.cands.map((c) => '<button class="li" data-f="c" data-c="' + c.id + '"><span class="l"><b>' + esc(c.name) + '</b><small>' + esc(c.ort) + ' · ' + lastTxt(c) + '</small></span>' + ring(due(c)) + '</button>').join('') : rows(o.q)) + '</div>',
      { c: (b) => openPropose(b.dataset.c, o.p || {}), input: (e) => { if (e.target.id === 'cs') $('#cl').innerHTML = rows(e.target.value); } });
  }
  function openFill(days) {
    const res = planFill(days);
    if (!res.rows.length) { toast('Alle fälligen Kunden sind schon eingeplant.'); return; }
    const span = days.length === 1 ? shortLbl(days[0]) : shortLbl(days[0]) + ' bis ' + shortLbl(days[days.length - 1]);
    openSheet('<div class="eb">Auto-Planung · ' + span + '</div><h2>' + res.rows.length + ' fällige Besuche passen rein</h2><div class="sub">Nach Dringlichkeit, entlang deiner Touren. +' + res.km + ' km gesamt.</div>' +
      '<div class="list">' + res.rows.map((x) => '<div class="li"><span class="l"><b>' + esc(x.c.name) + '</b><small>' + esc(x.c.ort) + ' · ' + lastTxt(x.c) + '</small></span><span class="r2">' + shortLbl(x.d) + '<br>' + fm(x.start) + '</span></div>').join('') + '</div>' +
      '<button class="primary" data-f="ok">Alle übernehmen</button><button class="secondary" data-f="no">Verwerfen</button>',
      { ok: () => { snap(); S = JSON.parse(res.after); save(); closeSheet(); render(); toast(res.rows.length + ' Besuche eingeplant', true); }, no: closeSheet });
  }
  function applyOrder(d, bo) { snap(); bo.l2.forEach((a, k) => { a.seq = k; }); reflowDay(d); save(); render(); toast(bo.saved >= 6 ? 'Umgestellt · ' + bo.saved + ' min weniger Fahrt' : 'Umgestellt', true); }
  function openSettings() {
    const opt = (from, to, val) => { let h = ''; for (let m = from; m <= to; m += 30) h += '<option value="' + m + '"' + (m === val ? ' selected' : '') + '>' + fm(m) + '</option>'; return h; };
    openSheet('<div class="eb">Einstellungen</div><h2>Dein Arbeitstag</h2>' +
      '<div><div class="set"><span>Erster Termin ab</span><select id="sS">' + opt(360, 600, S.set.start) + '</select></div>' +
      '<div class="set"><span>Zurück bis</span><select id="sE">' + opt(900, 1200, S.set.end) + '</select></div>' +
      '<div class="set"><span>Startpunkt</span><span class="mono" style="color:var(--mute)">' + HOME.name + ' ' + HOME.ort + '</span></div></div>' +
      '<p class="note">Alle Daten bleiben auf diesem iPhone. Die Kunden sind Beispieldaten aus dem Rhein-Main-Gebiet. Die Karte wird lokal gezeichnet, es werden keine Kartendienste abgefragt.</p>' +
      '<button class="secondary" data-f="reset" id="rs">Beispieldaten neu laden</button>',
      { change: (e) => {
        if (e.target.id === 'sS') S.set.start = +e.target.value;
        if (e.target.id === 'sE') S.set.end = +e.target.value;
        const T = today(); [...new Set(S.appts.filter((a) => a.d >= T).map((a) => a.d))].forEach((d) => reflowDay(d)); save(); render();
      },
      reset: (b) => {
        if (!b.dataset.sure) { b.dataset.sure = '1'; b.textContent = 'Wirklich? Tippen zum Bestätigen'; b.style.color = 'var(--warn)'; return; }
        S = seed(); save(); V.day = startDay(); closeSheet(); render(); toast('Beispieldaten neu geladen');
      } });
  }
  UI = { openMove, applyOrder, commit, openFill };

  /* ---------- command ---------- */
  function run(text) {
    text = text.trim(); if (!text) return;
    const p = parse(text); $('#q').value = ''; renderHint(); $('#q').blur();
    if (p.kind === 'fill') return openFill(p.days || fillDays(V.day));
    if (p.kind === 'route') { const d = p.days ? p.days[0] : V.day, bo = bestOrder(d); if (bo) { V.day = d; applyOrder(d, bo); } else toast('Die Reihenfolge ist schon die beste.'); return; }
    if (!p.cid) return openAll({ title: p.cands.length ? 'Wen meinst du genau?' : 'Wen meinst du?', cands: p.cands, p: { days: p.days, fix: p.fix, win: p.win, dur: p.dur } });
    const c = cust(p.cid);
    if (p.kind === 'cancel' || p.kind === 'move') {
      const fut = S.appts.filter((a) => a.c === p.cid && !isDone(a)).sort((a, b) => a.d < b.d ? -1 : a.d > b.d ? 1 : a.start - b.start);
      const a = p.kind === 'cancel' && p.days ? fut.find((x) => p.days.includes(x.d)) || fut[0] : fut[0];
      if (!a) { if (p.kind === 'cancel') return toast('Kein offener Termin mit ' + c.short + '.'); }
      else if (p.kind === 'cancel') { snap(); const d = a.d; S.appts = S.appts.filter((x) => x !== a); reflowDay(d); save(); render(); return toast(c.short + ' am ' + shortLbl(d) + ' abgesagt', true); }
      else return openPropose(p.cid, { days: p.days, fix: p.fix, win: p.win, dur: p.dur || a.dur, replace: a.id, excludeDay: p.days ? null : a.d });
    }
    openPropose(p.cid, { days: p.days, fix: p.fix, win: p.win, dur: p.dur });
  }
  $('#cmd').addEventListener('submit', (e) => { e.preventDefault(); run($('#q').value); });
  $('#q').addEventListener('input', renderHint);
  const EX = ['Hofmann morgen früh', 'Brenner Freitag um 14 Uhr, 90 Minuten', 'Woche füllen', 'Verschiebe Linde auf Montag', 'Novak nächste Woche nachmittags', 'Sag Krämer ab'];
  let exI = 0; const setPh = () => { $('#q').placeholder = 'z. B. „' + EX[exI++ % EX.length] + '“'; }; setPh();

  /* voice (Safari's built-in speech recognition; falls back to the keyboard's dictation key) */
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition; let rec = null;
  const mic = $('#mic');
  const dictHint = () => { $('#q').focus(); toast('Tipp: Die Mikrofon-Taste der iPhone-Tastatur funktioniert genauso.'); };
  mic.addEventListener('click', () => {
    if (mic.classList.contains('live')) { try { rec.stop(); } catch { /* ignore */ } return; }
    if (!SR) return dictHint();
    try {
      rec = new SR(); rec.lang = 'de-DE'; rec.interimResults = true; rec.continuous = false; let fin = '', failed = false;
      rec.onresult = (e) => { let s = ''; for (const r of e.results) s += r[0].transcript; $('#q').value = s; fin = s; renderHint(); };
      rec.onerror = (e) => { failed = true; mic.classList.remove('live'); if (e.error !== 'no-speech' && e.error !== 'aborted') dictHint(); };
      rec.onend = () => { mic.classList.remove('live'); if (!failed && fin.trim()) setTimeout(() => run(fin), 350); };
      rec.start(); mic.classList.add('live');
    } catch { mic.classList.remove('live'); dictHint(); }
  });

  /* clicks */
  const setMode = (m) => { if (mode === m) return; mode = m; try { localStorage.setItem('plantafel.mode', m); } catch { /* ignore */ } render(); };
  $('#vPlan').addEventListener('click', () => setMode('plan'));
  $('#vMap').addEventListener('click', () => setMode('map'));
  $('#back').addEventListener('click', () => hooks.onExit?.());
  $('#week').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.w) V.day = shiftWork(addD(V.day, +b.dataset.w)); else V.day = b.dataset.d;
    render();
  });
  $('#dayTitle').addEventListener('click', () => { V.day = startDay(); render(); });
  $('#gear').addEventListener('click', openSettings);
  $('#ins').addEventListener('click', (e) => { if (e.target.id === 'insAct' && insFn) insFn(); });
  $('#hint').addEventListener('click', (e) => { const b = e.target.closest('.chip'); if (!b) return; if (b.id === 'allC') openAll(); else openPropose(b.dataset.c); });
  view.addEventListener('click', (e) => {
    if (e.target.id === 'fillDay') return openFill([V.day]);
    const s = e.target.closest('[data-id]'); if (s) return openStop(s.dataset.id);
    const dd = e.target.closest('[data-due]'); if (dd) return openPropose(dd.dataset.due, { days: [V.day] });
    const g = e.target.closest('.gap'); if (g) return openGap(+g.dataset.gi);
  });
  { let x0 = null, y0 = null;
    view.addEventListener('touchstart', (e) => { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; }, { passive: true });
    view.addEventListener('touchend', (e) => {
      if (x0 == null) return; const dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0; x0 = null;
      if (Math.abs(dx) > 70 && Math.abs(dy) < 45) { let k = V.day; do { k = addD(k, dx < 0 ? 1 : -1); } while (!isWork(k)); V.day = k; render(); }
    }); }
  const onVis = () => { if (!document.hidden) render(); };

  return {
    host,
    mount() {
      S = load();
      V.day = startDay();
      render();
      // the map needs its real size, which exists only after layout
      requestAnimationFrame(() => { if (mode === 'map') renderMap(); });
      document.addEventListener('visibilitychange', onVis);
      timers.push(setInterval(() => { if (document.activeElement !== host && !$('#q').value) setPh(); }, 4200));
      timers.push(setInterval(() => { if (sheet.hidden) render(); }, 60000));
    },
    unmount() {
      document.removeEventListener('visibilitychange', onVis);
      timers.splice(0).forEach(clearInterval);
      try { rec?.abort(); } catch { /* ignore */ }
      closeSheet();
      save();
    },
    resize() { if (mode === 'map') renderMap(); }
  };
}
