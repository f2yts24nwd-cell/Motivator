// Content for "Mission RC 0": the S/4HANA conversion with the CRM add-on of the Ludlein Crew.
// Two humour modes: "kunde" (polite, for customers and partners) and "intern" (dirty, in-house only).
// Every text pool has a polite part `k` and an optional internal part `i`.

import { storeGet, storeSet } from '../../core/ui.js';

export const MODE_KEY = 'conversion-mode';
export const getMode = () => (storeGet(MODE_KEY, 'kunde') === 'intern' ? 'intern' : 'kunde');
export const setMode = (m) => storeSet(MODE_KEY, m === 'intern' ? 'intern' : 'kunde');

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

/** Picks a line from a pool; in internal mode the dirty lines win most of the time. */
export function say(pool, mode = getMode()) {
  if (!pool) return '';
  if (typeof pool === 'string') return pool;
  if (Array.isArray(pool)) return pick(pool);
  if (mode === 'intern' && pool.i?.length && (Math.random() < 0.75 || !pool.k?.length)) return pick(pool.i);
  return pick(pool.k);
}
/** All lines of a pool for the current mode (for projectiles, crate texts …). */
export function poolFor(pool, mode = getMode()) {
  return mode === 'intern' && pool.i ? [...pool.k, ...pool.i] : pool.k;
}

// ------------------------------------------------------------------ the six phases
export const PHASES = [
  {
    id: 'kit', name: 'Conversion Kit installieren', short: 'Conversion Kit', color: '#19c3ff',
    flavor: ['Das Kit fürs Kit', 'Kit-Voraussetzungen', 'Kit-Patch 3 von 7', 'Das Kit fürs Kit fürs Kit'],
    done: { k: ['Conversion Kit installiert. Das Kit fürs Kit fürs Kit läuft.'], i: ['Kit drauf. Hat nur drei Anläufe und einen Nervenzusammenbruch gebraucht.'] }
  },
  {
    id: 'backup', name: 'Backup in Z-Tabellen', short: 'Backup', color: '#ffb000',
    flavor: ['ZZ_CRM_BACKUP', 'ZZ_CRM_BACKUP_FINAL', 'ZZ_CRM_BACKUP_FINAL_V2', 'ZZ_BKP_NEU_NICHT_LOESCHEN', 'ZZ_SICHERUNG_KLAUS', 'ZZ_BACKUP_VOM_BACKUP'],
    done: { k: ['Alles gesichert. In Tabellen mit sehr kreativen Namen.'], i: ['Backup fertig. Die Tabellennamen klingen wie Dateinamen auf Kevins Desktop.'] }
  },
  {
    id: 'uninstall', name: 'Altes CRM deinstallieren', short: 'Deinstallation', color: '#ff3b5c',
    flavor: ['Tschüss, altes CRM', 'Deinstallation per SAINT', 'Letzte Ehre', 'Danke für alles'],
    done: { k: ['Ruhe in Frieden, altes CRM. Danke für viele treue Jahre.'], i: ['Das alte CRM ist tot. Es lebe das CRM! Taschentücher liegen am Empfang.'] }
  },
  {
    id: 'sum', name: 'Die Conversion (SUM)', short: 'Conversion', color: '#a46bff',
    flavor: ['SUM-Phase 1 von 99', 'Fortschritt: 99 % (seit 3 Std.)', 'DMO läuft', 'Restzeit: ja'],
    done: { k: ['Die Conversion ist durch. Willkommen in SAP S/4HANA!'], i: ['SUM ist durch. Der Fortschrittsbalken hat zum ersten Mal nicht gelogen.'] }
  },
  {
    id: 'newcrm', name: 'Neues itmX CRM der Ludlein Crew', short: 'Neues CRM', color: '#50af30',
    flavor: ['Ludlein Edition', 'Mit dickem Auspuff', 'Tieferlegung inklusive', 'Frisch aus der Garage'],
    done: { k: ['Das neue CRM ist drauf. Der CRX unter den CRM-Systemen!'], i: ['Neues CRM drauf. Brummt wie ein CRX mit Sportauspuff und ohne TÜV-Sorgen.'] }
  },
  {
    id: 'restore', name: 'Restore aus den Z-Tabellen', short: 'Restore', color: '#ff7ac0',
    flavor: ['Daten zurückspielen', 'ZZ_CRM_BACKUP_FINAL_V2', 'Wo ist KLAUS?', 'Alles wieder da'],
    done: { k: ['Alle Daten sind zurück. Sogar die von Klaus.'], i: ['Restore fertig. Und ja, wir haben KLAUS gefunden. Im Papierkorb.'] }
  }
];
export const PER_PHASE = 3;

// Transports that must never reach production. Correct move: let them roll by.
export const JUNK = {
  k: [
    'Testauftrag ohne Beschreibung', 'Transport von 2014', 'Bitte nicht importieren!', 'Kopie von Kopie von Transport',
    'Hotfix vom Freitagnachmittag', 'Workbench-Auftrag „asdf“', 'Nur kurz was ausprobiert', 'Vergessener Customizing-Auftrag'
  ],
  i: [
    'SAP_ALL für den Praktikanten', 'Kevins Spielwiese ZZ_KEVIN', '„Geht schon“ – Hotfix Fr. 16:59', 'Debug-Breakpoint in PRD',
    'Z_PROGRAMM_VOM_DEM_DER_WEG_IST', 'ZZ_TEST_TEST_FINAL_KAPUTT', 'Feierabend-Transport vom Chef'
  ]
};
export const JUNK_OWNERS = ['Ex-Kollege', 'Praktikant', 'unbekannt', 'Berater von 2014', 'DDIC', 'Kevin'];
// stamps on fake crates that look like the current phase
export const FAKE_STAMPS = { k: ['UNGETESTET', 'NICHT FREIGEGEBEN', 'ENTWURF'], i: ['UNGETESTET', 'FREITAG 16:59', 'VON KEVIN', 'WIRD SCHON GEHEN'] };

// ------------------------------------------------------------------ people
// Consultants get fantasy names with a slight hint of incompetence.
export const CONSULTANTS = [
  { name: 'Kai Ahnung', title: 'Senior Expert (seit Montag)' },
  { name: 'Rainer Zufall', title: 'Lead Architect' },
  { name: 'Theo Retisch', title: 'Principal Consultant' },
  { name: 'Ann Nahme', title: 'S/4-Evangelistin' },
  { name: 'Udo Kumentation', title: 'Hat den Hinweis nicht gelesen' },
  { name: 'Ingo Ogle', title: 'Experte, laut eigener Suche' },
  { name: 'Rolf Back', title: 'Cutover-Manager' },
  { name: 'Mira Egal', title: 'Projektleiterin' }
];

export const CONSULTANT_LINES = {
  start: { k: ['Alles im Griff. Glaube ich.', 'Downtime-Fenster offen. Los geht’s!'], i: ['Ich hab mein Deo im Hotel vergessen.', 'Ganz ruhig. Ich hab das schon zweimal auf Folien gemacht.'] },
  ok: { k: ['RC 0! Läuft!', 'Sauber.', 'So muss das.'], i: ['RC 0! Ich hab doch gesagt, ich kann das!', 'Läuft. Keiner sagt dem Kunden, dass ich geraten hab.'] },
  rc4: { k: ['Den hatten wir doch schon …', 'Warnung. Passt schon.'], i: ['RC 4. Passt schon, sagt man bei uns im Projekt.'] },
  rc8: { k: ['Falsche Reihenfolge!', 'Im Testsystem lief das aber!', 'Hm. Das war zu früh.'], i: ['Im Testsystem lief das aber! … Wir haben kein Testsystem.', 'Ich bin eigentlich FI-Berater.'] },
  rc12: { k: ['Kurzdump! Wer war das?', 'Das hätte nie nach PRD gedurft!', 'Oh nein. ST22.'], i: ['Oh Gott, oh Gott, oh Gott.', 'Ich schwitze durchs Sakko.', 'Wer hat den Praktikanten an STMS gelassen?!'] },
  junkOk: { k: ['Richtig liegen gelassen!', 'Der bleibt draußen.'], i: ['Ab in die Tonne mit dem Mist.', 'Kevin, nein.'] },
  missed: { k: ['Der hängt jetzt im Puffer …'], i: ['Puffer. Toll. Noch eine Leiche im Keller.'] },
  boss: { k: ['Was ist DAS denn?!', 'Der Business Partner! Den haben wir im Plan vergessen!'], i: ['Ich hab gerade in meine Anzughose geschwitzt.', 'Hat irgendwer CVI gemacht? Irgendwer? Hallo?!'] },
  bossDown: { k: ['Geschafft! Der Business Partner ist jetzt unser Freund.'], i: ['Ha! Und tschüss. Ich brauch ’ne Dusche.'] },
  bossLeft: { k: ['Er ist weg … für dieses Mal.'], i: ['Er ist abgehauen. Zum nächsten Projekt. Die Armen.'] },
  hurry: { k: ['Montag früh stehen die User vor der Tür!'], i: ['Noch zwei Stunden bis Montag. Ich kündige.'] },
  dumps: { k: ['Noch ein Kurzdump und das System ist hinüber!'], i: ['Noch ein Dump und ich wandere aus.'] },
  ask: { k: ['Ich frag mal kurz beim Product Management …'], i: ['Ich ruf das Orakel an. Hoffentlich ist es nicht im Bett.'] },
  noJoker: { k: ['Product Management hat Feierabend. Ab jetzt selber denken!'], i: ['Das Orakel geht nicht mehr ran. Ich glaub, es hat mich blockiert.'] }
};

// What the consultant asks the oracle
export const PM_QUESTIONS = {
  k: [
    'Ähm … welcher Transport kommt jetzt nochmal?',
    'Müssen wir das CRM wirklich erst deinstallieren?',
    'Was ist eigentlich ein Business Partner?',
    'Ist RC 8 schlimm?',
    'Kann man die Conversion auch einfach überspringen?'
  ],
  i: [
    'Ich hab aus Versehen was nach PRD transportiert. Schlimm?',
    'Kann ich SE16N mit Änderungsrecht nehmen? Nur ganz kurz?',
    'Wo steht nochmal, was ich hier eigentlich mache?',
    'Wie erkläre ich dem Kunden einen Kurzdump als Feature?'
  ]
};
// The all-knowing oracle answers …
export const PM_ANSWERS = {
  k: [
    'Das ist kein Bug, das ist ein Feature.',
    'It depends.',
    'Steht im Hinweis. Seite 47, Fußnote 3.',
    'Kommt im nächsten Release. Vielleicht.',
    'Hab ich im Kick-off gesagt. Zweimal.',
    'Immer die Kiste mit der richtigen Nummer. Immer.'
  ],
  i: [
    'Samstag, drei Uhr nachts. Ernsthaft? Ich lag gerade so schön im Bett.',
    'Lies den verdammten Hinweis.',
    'Wer hat dem Berater Schreibrechte in PRD gegeben?!',
    'Ich bin ein allwissendes Orakel, kein Babysitter.',
    'Frag mich noch einmal, und ich schalte das Handy aus.'
  ]
};
export const PM_EFFECT = {
  crates: 'Das Orakel lässt alle richtigen Transporte golden leuchten und entlarvt die falschen.',
  boss: 'Das Orakel zeigt die Schwachstelle: Für kurze Zeit macht jeder Treffer doppelten Schaden.'
};
export const PM_JOKERS = 3;

// The Ludlein Crew: makers of the CRM add-on. Absolutely fantastic.
export const CREW_TEAMS = ['Team Rocket (Frontend)', 'ABAP Pros', 'PM Experts'];
export const CREW = [
  { id: 'danny', name: 'Danny the Boss', color: '#ffcc4d', ini: 'DB' },
  { id: 'twin', name: 'The Good Twin', color: '#19c3ff', ini: 'GT' },
  { id: 'saar', name: 'Saar DEV', color: '#50af30', ini: 'SD' },
  { id: 'cut', name: 'Finest CUT', color: '#ff7ac0', ini: 'FC' },
  { id: 'whity', name: 'Whity', color: '#e8eefc', ini: 'W' }
];
export const CREW_LINES = {
  arrive: [
    ['danny', { k: ['Ludlein Crew, aufsitzen! Wir bringen das neue CRM.'], i: ['Aufsitzen, Leute! Das neue CRM kommt mit Sportauspuff.'] }],
    ['saar', { k: ['Hauptsach gudd importiert!'], i: ['Hauptsach gudd importiert. Der Rest is Schwenker.'] }]
  ],
  turbo: [
    ['danny', { k: ['Vollgas!'], i: ['Gas geben, bis der Auspuff glüht!'] }],
    ['twin', { k: ['Keine Sorge, ich bin der gute Zwilling.'], i: ['Ich bin der gute Zwilling. Der böse hat das Testsystem zerschossen.'] }],
    ['cut', { k: ['Cutover? Mach ich. Sauber wie immer.'], i: ['Finest CUT. Sauberer schneidet keiner.'] }],
    ['whity', { k: ['Oberfläche frisch poliert!'], i: ['Frisch poliert. Da kann man sich drin spiegeln.'] }],
    ['saar', { k: ['Hauptsach gudd importiert!'], i: ['Allez hopp, rin damit!'] }]
  ],
  golive: [
    ['danny', { k: ['Go-Live! Die Ludlein Crew sagt danke.'], i: ['Go-Live! Erste Runde geht auf Danny.'] }]
  ]
};
export const crewById = (id) => CREW.find((c) => c.id === id);

// ------------------------------------------------------------------ boss: SAP Business Partner
export const BP_HEADS = [
  { id: 'deb', label: 'Debitor', color: 0x1e9bd7 },
  { id: 'cp', label: 'Ansprechpartner', color: 0x8a4fd6 },
  { id: 'kred', label: 'Kreditor', color: 0xe07a1f }
];
export const BP_LINES = {
  enter: { k: ['Ich bin der Business Partner. Ohne mich kein S/4HANA!', 'Debitoren und Kreditoren? Gehören jetzt mir!'], i: ['Ich fress eure Debitoren zum Frühstück!', 'Eure Stammdaten sind ein Saustall. Ich räum auf. Auf meine Art.'] },
  defeat: 'Na gut … aber ich bin trotzdem Pflicht.'
};
export const BP_ERRORS = {
  k: ['BP-Rolle fehlt', 'Nummernkreis überlappt', 'CVI-Mapping fehlt', 'Pflichtfeld leer', 'Debitor ohne BP', 'Steuernummer ungültig', 'Adresse doppelt', 'Ansprechpartner verwaist'],
  i: ['48.000 Kunden ohne PLZ', 'Kunde „Test Test“ in PRD', 'Kreditor „Mama“', 'Debitor „Bitte löschen“', 'Ansprechpartner „Der Nette“']
};

// ------------------------------------------------------------------ results
export const RANKS = [
  { id: 'gold', name: 'Gold', rc: 'RC 0', min: 7000, title: 'Conversion-Legende', line: 'Fehlerfrei durchs Downtime-Fenster.' },
  { id: 'silber', name: 'Silber', rc: 'RC 4', min: 4500, title: 'Transport-Profi', line: 'Ein paar Warnungen, aber das System läuft.' },
  { id: 'bronze', name: 'Bronze', rc: 'RC 8', min: 2000, title: 'Basis-Azubi', line: 'Läuft … irgendwie. Montag wird spannend.' },
  { id: 'teilnahme', name: 'Teilnahme', rc: 'RC 12', min: 0, title: 'Kurzdump-Sammler:in', line: 'ST22 kennt jetzt deinen Namen.' }
];
export const rankFor = (pts) => RANKS.find((r) => pts >= r.min) || RANKS[RANKS.length - 1];

// Learning cards: real facts about transports and the S/4HANA conversion
export const LEARN = [
  { id: 'order', icon: '🔢', title: 'Reihenfolge ist alles', text: 'Transporte werden in einer festgelegten Reihenfolge importiert. Kommt einer zu früh, fehlen ihm Objekte, auf die er aufbaut, oder er überschreibt einen neueren Stand.' },
  { id: 'rc', icon: '🚦', title: 'Return Codes', text: 'Das Transportsystem meldet für jeden Import einen Return Code: 0 heißt fehlerfrei, 4 heißt Warnungen, 8 heißt Fehler bei einzelnen Objekten, ab 12 ist der Import abgebrochen.' },
  { id: 'addon', icon: '🧩', title: 'Add-ons vor der Conversion', text: 'Der Maintenance Planner prüft vor der Conversion alle installierten Add-ons. Ein Add-on ohne Freigabe für SAP S/4HANA wird durch eine kompatible Version ersetzt oder vorher deinstalliert.' },
  { id: 'backup', icon: '💾', title: 'Erst sichern, dann deinstallieren', text: 'Mit dem Add-on verschwinden auch seine Tabellen. Deshalb sichert ein Conversion Kit die Daten vorher in eigene Tabellen und spielt sie nach der Installation der neuen Version zurück.' },
  { id: 'sum', icon: '⚙️', title: 'SUM und DMO', text: 'Die technische Conversion übernimmt der Software Update Manager (SUM). Läuft das System noch nicht auf SAP HANA, migriert die Database Migration Option (DMO) die Datenbank im selben Durchlauf.' },
  { id: 'bp', icon: '👥', title: 'Business Partner ist Pflicht', text: 'In SAP S/4HANA werden Kunden und Lieferanten über den Geschäftspartner abgebildet. Die Customer-Vendor-Integration (CVI) muss vor der Conversion abgeschlossen sein, sonst schlagen die Vorab-Prüfungen an.' },
  { id: 'readiness', icon: '🩺', title: 'Readiness Check', text: 'Der SAP Readiness Check und die Simplification-Item-Prüfungen zeigen vorab, was im System angepasst werden muss, vom Eigenentwicklungs-Code bis zu den Stammdaten.' },
  { id: 'mock', icon: '🧪', title: 'Probeläufe', text: 'Vor der Produktion wird die Conversion mehrfach auf Kopien geprobt. So kennt man die Downtime und die Stolpersteine, bevor es am Wochenende ernst wird.' }
];

// ------------------------------------------------------------------ finale: Hannah aka S4HANNAH
export const HANNAH = {
  look: { top: 'kostuem', bottom: 'rock', shoes: 'pumps', acc: 'tuch', suit: 'anthrazit', accent: 'blau', hair: 'dutt', hairColor: 'blond', skin: 's1' },
  speaker: 'Hannah · aka S4HANNAH',
  intro: { k: ['Hi, ich bin Hannah. Hier nennen mich alle nur S4HANNAH. Ich hab dein ganzes Downtime-Wochenende mitverfolgt.'], i: ['Hi, ich bin Hannah. Alle sagen S4HANNAH, und nein, ich hab den Namen nicht selbst erfunden. Ich hab dein Wochenende mitverfolgt.'] },
  rank: {
    gold: { k: ['RC 0 am ganzen Wochenende? Das sieht man selten. Großartige Arbeit!'], i: ['RC 0 am ganzen Wochenende? Ich bin beeindruckt. Und ich bin schwer zu beeindrucken.'] },
    silber: { k: ['Ein paar Warnungen, aber das System läuft stabil. Starke Leistung!'], i: ['Ein paar Warnungen. Passt schon, sagt die Basis. Und die Basis hat immer recht.'] },
    bronze: { k: ['Es lief nicht alles glatt, aber du hast durchgehalten. Beim nächsten Mal wird’s noch besser.'], i: ['Läuft. Irgendwie. Ich würde Montag trotzdem das Handy auslassen.'] },
    teilnahme: { k: ['Das war ein hartes Wochenende. Aber aus jedem Kurzdump lernt man etwas.'], i: ['Dein ST22 ist länger als mein Einkaufszettel. Aber hey: Du hast überlebt.'] }
  },
  hand: (rank) => `Hiermit erteile ich dir das S4 Patent, Stufe ${rank}. Und jetzt: Go-Live-Party!`
};

