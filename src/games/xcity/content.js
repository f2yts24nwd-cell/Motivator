// "Ludlein Bay: Operation X" – story, dialogue and the learning card.
// Characters are the ones of the itmX Spielewelt (Danny the Boss, Tim X., Cloudius von Silo).

export const WHO = {
  danny: { name: 'Danny the Boss', color: '#ffcc4d', ini: 'DB' },
  tim: { name: 'Tim X.', color: '#7dffb0', ini: 'TX' },
  tina: { name: 'Tina X.', color: '#ff7ad9', ini: 'TX' },
  cloudius: { name: 'Cloudius von Silo', color: '#9aa3ff', ini: '☁' },
  funk: { name: 'Silo-Security (Funk)', color: '#ff5a5a', ini: '📻' },
  passant: { name: 'Passant', color: '#ffb38a', ini: '🙂' }
};

// intro cutscene: camera shots + subtitles (t = seconds from start)
export const INTRO = [
  { t: 0.3, who: 'danny', text: 'Tim. Quartalsende, Freitag, goldene Stunde. Und genau jetzt passiert es.' },
  { t: 4.2, who: 'danny', text: 'Cloudius von Silo hat das X vom X-Platz geklaut. Die Kachel mit ALLEN Kundendaten. Customer 360.' },
  { t: 8.6, who: 'cloudius', text: 'Ab jetzt liegen eure Kunden in meinem Silo. Exportieren kostet extra!' },
  { t: 12.4, who: 'danny', text: 'Dein Dienstwagen steht am Platz. Hol dir das X zurück. Und bitte: nur den Van rammen, nicht die Kunden.' }
];

export const LINES = {
  getcar: 'Steig in deinen <b>Dienstwagen</b>.',
  getcarHint: 'Geh zum Auto und drück <kbd>F</kbd> (Handy: 🚗).',
  toVan: 'Fahr zur <b>itmX-Zentrale</b>. Cloudius lädt dort das <b class="x">X</b> in seinen Van.',
  chase: 'Ramm den <b class="red">Silo-Van</b>, bis er liegen bleibt.',
  grab: 'Steig aus und hol dir das <b class="x">X</b> zurück.',
  escape: 'Bring das <b class="x">X</b> zurück auf den <b class="x">X-Platz</b>.',
  backToCar: 'Steig wieder in ein <b>Auto</b>.',
  free: 'Freie Fahrt durch Ludlein Bay. Das X steht wieder, wo es hingehört.'
};

export const CHASE_CALLS = [
  { at: 1, who: 'danny', text: 'Da ist er! Weißer Van mit Wolke auf dem Dach. Bleib dran!' },
  { at: 9, who: 'cloudius', text: 'Schnittstellen? Bei mir gibt es nur Ausgänge. Für Daten. Gegen Gebühr.' },
  { at: 20, who: 'danny', text: 'Von hinten in die Ecke rammen, dann bricht er aus.' },
  { at: 34, who: 'cloudius', text: 'Dein CRM hat keine Chance gegen meine 47 Lizenzmodelle!' },
  { at: 50, who: 'danny', text: 'Er will zur Küste! Am Ocean Drive kannst du ihn packen.' }
];
export const HIT_LINES = [
  'Hey! Das ist ein Leasingfahrzeug!',
  'Der Kratzer kommt aufs Ticket!',
  'Mein Support meldet sich in 5–7 Werktagen!',
  'Das war nicht im Lizenzvertrag!',
  'Aua! Meine Cloud!'
];
export const ESCAPE_CALLS = [
  { at: 0.5, who: 'funk', text: 'Alle Einheiten: Das X verlässt das Silo! Daten-Exit verhindern!' },
  { at: 4, who: 'danny', text: 'Du hast es! Jetzt zurück zum X-Platz. Die Silo-Security ist hinter dir her.' },
  { at: 18, who: 'funk', text: 'Er fährt Richtung Platz! Straßensperre! Äh … wir haben keine Straßensperre lizenziert.' },
  { at: 32, who: 'danny', text: 'Gleich bist du da. Rein in den grünen Kreis!' }
];
export const COP_HIT = ['Silo-Security: Stehen bleiben! Datenhoheit!', 'Silo-Security: Das X gehört in die Wolke!', 'Silo-Security: Sie haben das Recht auf … ein Upgrade.'];

export const FAIL = {
  escaped: { title: 'AUFTRAG GESCHEITERT', sub: 'Cloudius ist mit dem X entkommen.' },
  wasted: { title: 'AUSGELOGGT', sub: 'Die Silo-Security hat dich erwischt. Session abgelaufen.' }
};

export const PASSED = {
  title: 'AUFTRAG ERLEDIGT',
  reward: 250000,
  sub: 'Das X ist zurück. Alle Kundendaten wieder an einem Ort.'
};

export const CARD = {
  title: 'Customer 360 – das X in der Mitte',
  text: 'Im itmX CRM laufen alle Kundendaten zusammen: Angebote und Aufträge aus dem ERP, Mails und Termine aus dem Postfach, Service-Tickets, Besuchsberichte und Kampagnen. Keine Insel, kein Silo, kein Export gegen Gebühr. Jeder im Team sieht den ganzen Kunden.',
  link: 'https://www.itmx.de'
};

export const NEON = ['itmX', 'CRM', 'SALES 24/7', 'Customer 360', 'DEAL DINER', 'MOTEL PIPELINE', 'LEAD BAR', 'FORECAST', 'OCEAN DRIVE', 'ERP + MAIL'];

export const PLACE_NAMES = [
  { x: 0, z: 0, name: 'X-Platz' },
  { x: 0, z: -80, name: 'itmX-Zentrale' },
  { x: 160, z: 0, name: 'Ocean Drive' },
  { x: -160, z: 160, name: 'Silo-Viertel' },
  { x: -160, z: -160, name: 'Altstadt' },
  { x: 80, z: 160, name: 'Hafen Süd' },
  { x: 80, z: -160, name: 'Palm Heights' }
];

export const fmtEuro = (n) => `${Math.round(n).toLocaleString('de-DE')} €`;
