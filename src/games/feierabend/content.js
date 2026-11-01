// Content for "Rettet den Feierabend!": tools, tasks, quotes and icons.
// Tasks and facts follow "A Day in the Life of a Salesman" on itmx.de; every tool links
// to the matching itmX video.

// Line icons (24×24 grid, rounded strokes). They are placeholders in the style of a modern
// web app; swap the paths for the original icons of the application here.
const PATHS = {
  outlook: '<rect x="2.5" y="5" width="13" height="14" rx="2"/><path d="M3.2 7.2 9 12l5.8-4.8"/><rect x="17.5" y="5" width="4" height="14" rx="1.2"/><path d="M18.6 8.5h1.8M18.6 11h1.8"/>',
  teams: '<path d="M6.6 3.5h2.6l1.3 4-2 1.4a12 12 0 0 0 6.6 6.6l1.4-2 4 1.3v2.6a2 2 0 0 1-2.2 2A17 17 0 0 1 4.6 5.7a2 2 0 0 1 2-2.2z"/><path d="M15 3.5a6 6 0 0 1 5.5 5.5M15 7a2.6 2.6 0 0 1 2 2"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.2"/><path d="m15.2 15.2 5.6 5.6"/><path d="M8 10.5a2.5 2.5 0 0 1 2.5-2.5"/>',
  c360: '<rect x="2.5" y="4.5" width="19" height="15" rx="2.5"/><circle cx="9" cy="10.3" r="2.5"/><path d="M5.3 16.6c.7-1.9 2.1-2.9 3.7-2.9s3 1 3.7 2.9M15 9.5h3.6M15 12.8h3.6"/>',
  kanban: '<rect x="2.5" y="3.5" width="19" height="17" rx="2.5"/><path d="M8.8 3.5v17M15.2 3.5v17"/><rect x="4.3" y="6" width="2.8" height="3.6" rx=".7"/><rect x="10.6" y="6" width="2.8" height="6" rx=".7"/><rect x="16.9" y="6" width="2.8" height="2.6" rx=".7"/>',
  voice: '<rect x="9" y="2.8" width="6" height="11" rx="3"/><path d="M5.5 10.8a6.5 6.5 0 0 0 13 0M12 17.3v3.4M8.6 20.7h6.8"/>',
  offer: '<path d="M6 2.5h8l4.5 4.5v13a1.5 1.5 0 0 1-1.5 1.5H6A1.5 1.5 0 0 1 4.5 20V4A1.5 1.5 0 0 1 6 2.5z"/><path d="M14 2.5V7h4.5"/><path d="M14.4 12.4a3 3 0 1 0 0 4.4M8.6 13.8h4.6M8.6 15.5h4.6"/>',
  ticket: '<path d="M3 7.5A1.5 1.5 0 0 1 4.5 6h15A1.5 1.5 0 0 1 21 7.5V10a2 2 0 0 0 0 4v2.5a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 16.5V14a2 2 0 0 0 0-4z"/><path d="M15 6.5v1.6M15 11.2v1.6M15 15.9v1.6"/><path d="M6.5 10.5h5M6.5 13.5h3.5"/>',
  trash: '<path d="M4 6.5h16M9.5 6.5V4.4h5v2.1M6 6.5l1 13a1.5 1.5 0 0 0 1.5 1.4h7a1.5 1.5 0 0 0 1.5-1.4l1-13M10 10.5v6.5M14 10.5v6.5"/>',
  mug: '<path d="M4.5 8h11v7a4.5 4.5 0 0 1-4.5 4.5H9A4.5 4.5 0 0 1 4.5 15z"/><path d="M15.5 9.5h1.7a2.6 2.6 0 0 1 0 5.2h-1.7"/><path d="M8 3.5c-.8 1 .8 1.6 0 2.8M11.5 3.5c-.8 1 .8 1.6 0 2.8"/>',
  legacy: '<rect x="3.5" y="3.5" width="17" height="17" rx="2"/><path d="M3.5 9h17M3.5 14.5h17M9 3.5v17M14.5 3.5v17"/>'
};

export function iconSVG(id, color = '#ffffff', stroke = 1.7) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="96" height="96" fill="none" stroke="${color}" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round">${PATHS[id]}</svg>`;
}

const imgCache = new Map();
/** Loads every icon in the given colour as an <img> so it can be drawn into canvases. */
export function loadIcon(id, color = '#ffffff') {
  const key = `${id}|${color}`;
  if (!imgCache.has(key)) {
    imgCache.set(key, new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(iconSVG(id, color))}`;
    }));
  }
  return imgCache.get(key);
}

export const TOOLS = [
  { id: 'outlook', name: 'Outlook + CRM', color: '#2b88d8', fact: 'Outlook zeigt die CRM-Daten direkt neben jeder Mail: Absender, Verkaufschancen, Tickets. E-Mails landen ohne Toolwechsel im CRM.', video: '27GmXZkyR20' },
  { id: 'teams', name: 'Teams-Anruf', color: '#7b83eb', fact: 'Anrufe direkt in Microsoft Teams annehmen und mit einem Klick ins CRM springen. Kein Systemwechsel, kein Kontextverlust.', video: 'DhcXtiptUb8' },
  { id: 'search', name: 'Globale Suche', color: '#19c3ff', fact: 'Die Globale Suche findet Kunden wie Siemens in Sekunden, mit allen Aktivitäten und der ganzen Historie.', video: 'HtlT369Z-wU' },
  { id: 'c360', name: 'Customer 360', color: '#6cc84a', fact: 'Rolle, frühere Kontakte, zuständige Kolleg:innen und Vorlieben eines Ansprechpartners auf einen Blick, bevor man ihn zum ersten Mal trifft.', video: 'LQtaJgMlxMQ' },
  { id: 'kanban', name: 'Pipeline', color: '#ffb000', fact: 'Die Pipeline als Kanban-Board: Verkaufschancen direkt an Ort und Stelle bearbeiten, ohne sich durch Masken zu klicken.', video: 'HXTr7IgqUgA' },
  { id: 'voice', name: 'Bericht per Sprache', color: '#ff3d9a', fact: 'Besuchsberichte unterwegs einfach einsprechen. Die AI Voice Visit App macht daraus einen fertigen Bericht im CRM.', video: 'buiHRyg9lmE' },
  { id: 'offer', name: 'Angebot in SAP', color: '#3ddc84', fact: 'Angebote komplett im CRM erstellen und direkt in SAP öffnen. Nahtlos integriert, ohne Wechsel zwischen den Systemen.', video: '1CVNP99J-wA' },
  { id: 'ticket', name: 'Ticket', color: '#ff7a45', fact: 'Reklamationen direkt aus Outlook als Ticket anlegen. Das richtige Team übernimmt, und jede Beschwerde wird nachverfolgt.', video: 'HPb87hK9uHk' },
  { id: 'trash', name: 'Ab in die Tonne', color: '#9aa6bd', fact: 'Excel-Listen, Disketten und Zettelwirtschaft braucht niemand mehr: Alle Daten liegen online im CRM, auf jedem Gerät.', video: 'O2sUV9Ya_aw' }
];
export const TOOL = Object.fromEntries(TOOLS.map((t) => [t.id, t]));

// Work tasks from Tim X.'s day. `tool` is the right answer.
export const TASKS = [
  { tool: 'teams', who: 'Eingehender Anruf', what: ['Thomas Hüttges ruft an!', 'Kunde ruft wegen Liefertermin an', 'Jessica Red will einen Termin'] },
  { tool: 'outlook', who: 'Posteingang', what: ['Mail von unbekanntem Absender', '23 neue Mails seit dem Mittag', 'Mail einpflegen, aber schnell'] },
  { tool: 'search', who: 'Kundendaten', what: ['Schnell alles zu Siemens!', 'Was lief zuletzt bei der Müller AG?', 'Wo ist die Historie zu Kunde 4711?'] },
  { tool: 'c360', who: 'Termin um 13:00', what: ['Wer genau ist Jessica Red?', 'Neuer Einkäufer: Was mag er?', 'Wer im Team kennt die Kundin?'] },
  { tool: 'kanban', who: 'Vertriebsleiter', what: ['„Zeig mal deine Pipeline!“', 'Welche Deals schließen diesen Monat?', 'Chance auf „gewonnen“ schieben'] },
  { tool: 'voice', who: 'Unterwegs', what: ['Besuchsbericht fällig, du sitzt im Auto', 'Mittagspause und der Bericht fehlt', 'Bericht diktieren, bevor du es vergisst'] },
  { tool: 'offer', who: 'Kunde wartet', what: ['„Schicken Sie mir heute ein Angebot?“', 'Preis nachverhandelt: neues Angebot!', 'Angebot von letzter Woche anpassen'] },
  { tool: 'ticket', who: 'Reklamation', what: ['Artikel fehlt in der Lieferung!', 'Kunde beschwert sich per Mail', 'Ware beschädigt angekommen'] }
];

// "Das andere lassen": busywork from Dumêz G. Schwetz. Correct move: do nothing.
export const LASSEN = {
  who: 'Auftrag von Schwetz',
  what: ['Meeting zur Vorbereitung des Meetings', 'Statusmail an alle, zur Sicherheit', 'Folien für die Folien', 'Report, den keiner liest', 'Ablage nach Farben sortieren']
};

// Legacy junk flies in as the googly-eyed heads from "Hau den Legacy!"
export const LEGACY = ['excel', 'access', 'floppy', 'ie', 'clippy'];

export const QUOTE_SCHWETZ = 'Das eine nicht tun, dafür das andere lassen!';

export const TIM = {
  start: 'Okay. 17:30 ist Feierabend. Los geht’s!',
  fruit: 'Low Hanging Fruits! Schnell pflücken!',
  extra: 'Jetzt geh ich die Extra Meile!',
  extraEnd: 'Extra Meile geschafft. Weiter!',
  miss: ['Mist, wieder Papier …', 'Der Stapel wächst …', 'Das hätte ins CRM gehört.'],
  wrong: ['Falsches Tool!', 'Hm, das war nix.', 'Nee, anderes Werkzeug!'],
  lassenOk: 'Richtig gelassen. Zeit gespart!',
  lassenBad: 'Hätte ich mal gelassen …',
  legacy: ['Excel? Ab in die Tonne!', 'Diskette?! Echt jetzt?'],
  late: 'Gleich Feierabend. Endspurt!',
  stack: 'Achtung, der Stapel kippt gleich!'
};

export const SCHWETZ_LINES = [
  'Moin … *schlurf* … kurze Durchsage vom Chef persönlich:',
  'Ab jetzt kommen auch meine Aufträge rein. Meetings, Reports, Statusmails …',
  QUOTE_SCHWETZ,
  'Heißt: Meine Aufträge einfach durchrauschen lassen. Ich merk das eh nicht.'
];

// Ranks in "Minuten gespart" (90 s round = one working day)
export const RANKS_FB = [
  { id: 'gold', min: 420, title: 'Feierabend-Legende', line: 'Pünktlich raus und trotzdem alles erledigt.' },
  { id: 'silber', min: 260, title: 'Zeitspar-Profi', line: 'Viel geschafft, fast nichts auf Papier.' },
  { id: 'bronze', min: 130, title: 'CRM-Aufsteiger:in', line: 'Die Richtung stimmt. Morgen wird’s noch besser.' },
  { id: 'teilnahme', min: 0, title: 'Zettel-Sammler:in', line: 'Morgen bitte mehr CRM und weniger Papier.' }
];
export const rankForFb = (min) => RANKS_FB.find((r) => min >= r.min) || RANKS_FB[RANKS_FB.length - 1];

export const SCHWETZ_RANK = {
  gold: 'Alter … Feierabend um 17:30 und kein Blatt Papier auf dem Tisch. Das hab ich selbst noch nie geschafft.',
  silber: 'Nicht schlecht. Ein paar Zettel, aber die Extra Meile kennst du schon.',
  bronze: 'Okay, die Low Hanging Fruits hast du mitgenommen. Der Rest … nächstes Mal.',
  teilnahme: 'Dein Schreibtisch sieht aus wie meiner. Das ist kein Kompliment.'
};
