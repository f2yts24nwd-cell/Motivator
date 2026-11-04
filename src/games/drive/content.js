// Content for "Ludlein Drive": cars, tuning parts, missions and all lines.
// Every text pool has a polite part `k` (customers & partners) and an optional internal part `i`.
// The humor mode is shared with games 3 and 4 (same storage key).

import { storeGet, storeSet } from '../../core/ui.js';
export { getMode, setMode, say } from '../crm/content.js';

// ------------------------------------------------------------------ progress (per device)
const KEY = 'drive-progress';
export function loadProgress() {
  const p = storeGet(KEY, {}) || {};
  return {
    deals: Array.isArray(p.deals) ? p.deals : [], // mission ids won at least once
    wins: p.wins || 0, // total won missions (also repeats)
    provision: p.provision || 0,
    best: p.best || {}, // mission id -> best time in s
    car: p.car || 'fuenfer',
    configs: p.configs || {},
    steer: p.steer === 'tilt' ? 'tilt' : 'buttons',
    finale: !!p.finale
  };
}
export function saveProgress(p) { storeSet(KEY, p); }

// ------------------------------------------------------------------ paint
export const COLORS = [
  { id: 'weiss', name: 'Alpinweiß', hex: '#eef0f2' },
  { id: 'schwarz', name: 'Saphirschwarz', hex: '#0c0d10' },
  { id: 'grau', name: 'Mineralgrau', hex: '#5d6268' },
  { id: 'silber', name: 'Mondsilber', hex: '#b9bdc2' },
  { id: 'blau', name: 'Portimao-Blau', hex: '#1d4fa8' },
  { id: 'petrol', name: 'Petrol', hex: '#0f5560' },
  { id: 'gruen', name: 'itmX-Grün', hex: '#50af30' },
  { id: 'olive', name: 'Olibo-Grün', hex: '#4c5a3c' },
  { id: 'rot', name: 'Hilti-Rot', hex: '#c8101a' },
  { id: 'bordeaux', name: 'Bordeaux', hex: '#5a0f1f' },
  { id: 'orange', name: 'Sunset-Orange', hex: '#e8641b' },
  { id: 'gelb', name: 'Racing-Gelb', hex: '#f2c200' },
  { id: 'violett', name: 'Twilight-Violett', hex: '#4a2a7a' },
  { id: 'sand', name: 'Kalahari-Beige', hex: '#b8a487' }
];
export const FINISHES = [
  { id: 'uni', name: 'Uni' },
  { id: 'metallic', name: 'Metallic' },
  { id: 'matt', name: 'Matt' },
  { id: 'chamaeleon', name: 'Chamäleon' }
];
export const RIMS = [
  { id: 'fuenf', name: '5-Speiche' },
  { id: 'doppel', name: 'Doppelspeiche' },
  { id: 'viel', name: 'Vielspeiche' },
  { id: 'turbine', name: 'Turbine' },
  { id: 'aero', name: 'Aero' },
  { id: 'mesh', name: 'Kreuzspeiche' }
];
export const RIM_COLORS = [
  { id: 'silber', name: 'Silber', hex: '#c9ccd1', metal: 0.9, rough: 0.28 },
  { id: 'chrom', name: 'Chrom', hex: '#f2f4f7', metal: 1, rough: 0.06 },
  { id: 'anthrazit', name: 'Anthrazit', hex: '#3a3d42', metal: 0.8, rough: 0.35 },
  { id: 'schwarz', name: 'Schwarz glanz', hex: '#0d0e10', metal: 0.4, rough: 0.18 },
  { id: 'gold', name: 'Gold', hex: '#c9a14a', metal: 1, rough: 0.25 },
  { id: 'bronze', name: 'Bronze', hex: '#8a5a32', metal: 1, rough: 0.3 }
];
export const CALIPERS = [
  { id: 'grau', name: 'Serie', hex: '#4a4d52' },
  { id: 'rot', name: 'Rot', hex: '#d0141e' },
  { id: 'gelb', name: 'Gelb', hex: '#f2c200' },
  { id: 'blau', name: 'Blau', hex: '#1f6fe0' },
  { id: 'gruen', name: 'itmX-Grün', hex: '#50af30' }
];
export const SPOILERS = [
  { id: 'none', name: 'Ohne' },
  { id: 'lip', name: 'Abrisskante' },
  { id: 'wing', name: 'Flügel' },
  { id: 'gt', name: 'GT-Flügel' }
];
export const PARTS = [
  { id: 'splitter', name: 'Frontsplitter', icon: '🔻' },
  { id: 'skirts', name: 'Seitenschweller', icon: '➖' },
  { id: 'diffusor', name: 'Diffusor & Sportauspuff', icon: '💨' },
  { id: 'stripes', name: 'itmX-Streifen', icon: '🏁' },
  { id: 'rack', name: 'Dachträger + Hilti-Koffer', icon: '🧰' },
  { id: 'box', name: 'Dachbox', icon: '📦' }
];

// ------------------------------------------------------------------ the five cars
// stats: vmax km/h, t100 s (0-100), grip 0..1, ev: range in km (game km)
export const CARS = [
  {
    id: 'fuenfer', name: 'Der Fünfer', sub: 'Business-Limousine', type: 'sedan', style: 'fuenfer',
    plate: 'LU-IT 5', vmax: 250, t100: 5.6, grip: 0.86,
    dims: { L: 4.96, W: 1.9, H: 1.47, wb: 2.98, wr: 0.36, belt: 0.95, hood: 0.8 },
    def: { color: 'blau', finish: 'metallic', rim: 'doppel', rimColor: 'anthrazit', caliper: 'blau', drop: 20, spoiler: 'lip', parts: [] },
    blurb: 'Hinterradantrieb, Sechszylinder-Sound, perfekt für die linke Spur.'
  },
  {
    id: 'skoda', name: 'Elektro-Škoda', sub: 'E-SUV, leise und schnell', type: 'suv', style: 'skoda', ev: true,
    plate: 'LU-E 360', vmax: 180, t100: 6.7, grip: 0.8, range: 9,
    dims: { L: 4.65, W: 1.88, H: 1.62, wb: 2.77, wr: 0.37, belt: 1.06, hood: 0.92 },
    def: { color: 'olive', finish: 'metallic', rim: 'aero', rimColor: 'anthrazit', caliper: 'grau', drop: 0, spoiler: 'none', parts: [] },
    blurb: 'Zieht ab wie ein Gummiband. Aber denk ans Laden: Ladesäulen findest du auf der Karte.'
  },
  {
    id: 'volvo', name: 'Volvo V60', sub: 'Kombi mit Hammer-Scheinwerfern', type: 'wagon', style: 'volvo',
    plate: 'LU-SV 60', vmax: 180, t100: 6.4, grip: 0.82,
    dims: { L: 4.76, W: 1.85, H: 1.43, wb: 2.87, wr: 0.35, belt: 0.97, hood: 0.86 },
    def: { color: 'silber', finish: 'metallic', rim: 'turbine', rimColor: 'silber', caliper: 'grau', drop: 10, spoiler: 'none', parts: [] },
    blurb: 'Bei 180 ist Schluss. Aus Sicherheitsgründen. Dafür passt der ganze Messestand in den Kofferraum.'
  },
  {
    id: 'sklasse', name: 'S-Klasse', sub: 'Das Geschäftsführer-Auto', type: 'sedan', style: 'sklasse', locked: 3,
    plate: 'LU-GF 1', vmax: 250, t100: 4.9, grip: 0.84,
    dims: { L: 5.18, W: 1.95, H: 1.5, wb: 3.11, wr: 0.37, belt: 0.98, hood: 0.86 },
    def: { color: 'schwarz', finish: 'metallic', rim: 'viel', rimColor: 'chrom', caliper: 'grau', drop: 0, spoiler: 'none', parts: [] },
    blurb: 'Fährt wie auf Wolken. Nur nicht auf denen von Cloudius.'
  },
  {
    id: 'passat', name: 'Hilti-Passat', sub: 'Roter Kombi mit Schriftzug', type: 'wagon', style: 'passat', hilti: true,
    plate: 'LU-HI 1', vmax: 220, t100: 7.1, grip: 0.83,
    dims: { L: 4.92, W: 1.85, H: 1.5, wb: 2.84, wr: 0.35, belt: 1.0, hood: 0.88 },
    def: { color: 'rot', finish: 'uni', rim: 'fuenf', rimColor: 'silber', caliper: 'grau', drop: 0, spoiler: 'none', parts: ['rack'] },
    blurb: 'Die Legende der linken Spur. Mit Dachträger und Koffer voller Werkzeug.'
  }
];
export const carById = (id) => CARS.find((c) => c.id === id) || CARS[0];

export const SCHULTERKLAPPEN = {
  k: ['Moment mal! Schau erst mal auf deine Schulterklappen. Die S-Klasse ist das Geschäftsführer-Auto. Hol erst drei Deals, dann reden wir.'],
  i: ['Ähm. Schau mal auf deine Schulterklappen. Da ist noch kein Stern drauf. Die S-Klasse fährt Danny. Erst drei Deals, dann darfst du mal Probe sitzen.', 'Netter Versuch! Mit null Deals direkt ins Geschäftsführer-Auto? Schulterklappen checken, drei Deals holen, dann reden wir.']
};

// ------------------------------------------------------------------ characters
export const DANNY = { id: 'danny', name: 'Danny the Boss', role: 'Vertriebsleitung', color: '#ffcc4d', ini: 'DB' };
export const CLOUDIUS = { id: 'cloudius', name: 'Cloudius von Silo', role: 'Fremd-CRM-Vertrieb', color: '#9aa3ff', ini: '☁' };
export const CALLERS = {
  danny: DANNY,
  cloudius: CLOUDIUS,
  spindler: { id: 'spindler', name: 'Frau Spindler', role: 'Fräsfix Maschinenbau', color: '#19c3ff', ini: 'FS' },
  palette: { id: 'palette', name: 'Frau Palette', role: 'Regalriese Großhandel', color: '#a46bff', ini: 'FP' },
  kelle: { id: 'kelle', name: 'Herr Kelle', role: 'Mörtelmeister Baustoffe', color: '#ffb000', ini: 'HK' },
  karla: { id: 'karla', name: 'Kampagnen-Karla', role: 'itmX Marketing', color: '#ff5fa8', ini: 'KK' },
  navi: { id: 'navi', name: 'Bordcomputer', role: 'itmX CRM mobil', color: '#50af30', ini: 'X' }
};

export const LINES = {
  intro: {
    k: ['Moin! Letzter Tag im Quartal, uns fehlen noch 500.000 €. Vier Kunden warten in Ludlein. Und Cloudius von Silo ist mit seiner Wolken-Flotte unterwegs. Hol dir im Fuhrpark einen Wagen und los!'],
    i: ['Moin! Quartalsende, und uns fehlen 500.000 €. Wenn wir das nicht schaffen, muss ich wieder Excel-Forecasts bauen. Und Cloudius kurvt schon durch die Stadt. Ab in den Fuhrpark!']
  },
  start: {
    k: ['Alles klar, Fahrzeug übernommen. Öffne die Aufträge im Bordcomputer und such dir einen Kunden aus.'],
    i: ['Schlüssel hast du. Kratzer zahlst du. Nein, Spaß. Aufträge sind im Bordcomputer.']
  },
  blitz: {
    k: ['Geblitzt! Das kostet 50 € Provision. Bitte an die Tempolimits denken.', 'Blitzer! Sicher ankommen ist wichtiger als schnell ankommen.'],
    i: ['Geblitzt! Das Foto kommt nicht ins CRM. Die 50 € aber in deine Abrechnung.', 'Blitz! Schönes Profilbild. Kostet 50 €.', 'Geblitzt! Hilti-Linke-Spur-Fahrer erkennen sich am Foto.']
  },
  lowBattery: {
    k: ['Der Akku ist fast leer. Fahr zur nächsten Ladesäule, sie ist auf der Karte markiert.'],
    i: ['Akku fast leer! Wenn du jetzt liegen bleibst, schiebst du. Ladesäule ist auf der Karte.']
  },
  emptyBattery: {
    k: ['Akku leer. Im Notbetrieb geht es mit 30 km/h zur nächsten Ladesäule.'],
    i: ['Akku leer! Kriechgang bis zur Ladesäule. Cloudius lacht sich gerade schlapp.']
  },
  charged: { k: ['Voll geladen! Weiter geht es.'], i: ['100 %! Strom kommt übrigens aus der Steckdose. Hat mir Kevin erklärt.'] },
  bump: { k: ['Hoppla!', 'Vorsicht!', 'Huch!'], i: ['Delle? Welche Delle?', 'Das war schon so!', 'Ups. Kommt nicht ins CRM.'] },
  pedestrian: ['Hey!', 'Huch!', 'Na hallo!', 'Pass doch auf!', 'Schönes Auto!'],
  honk: ['Mööp!', 'Hup!', 'Tröööt!'],
  reset: { k: ['Abschleppdienst: Du stehst wieder auf der Straße.'], i: ['Abgeschleppt. Wir reden nicht drüber.'] },
  sklasseUnlocked: {
    k: ['Drei Deals! Die Schulterklappen glänzen. Die S-Klasse steht im Fuhrpark für dich bereit.'],
    i: ['Drei Deals! Okay, du darfst die S-Klasse fahren. Aber Sitz nicht verstellen, das ist meiner!']
  },
  finale: {
    k: ['Quartalsziel erreicht! 500.000 € Umsatz, alle vier Kunden gewonnen. Danke dir, das war Spitzenklasse!'],
    i: ['Quartalsziel geknackt! Ich storniere sofort meinen Excel-Kurs. Feierabend, die Runde geht auf mich!']
  }
};

// ------------------------------------------------------------------ missions
// Places are defined in world.js (POI ids). reward: deal value in €; prov: base provision.
export const MISSIONS = [
  {
    id: 'fraesfix', title: 'Erstbesuch bei Fräsfix', place: 'fraesfix', icon: '🏭', reward: 100000, prov: 400, time: 110,
    customer: 'spindler', kind: 'visit', feature: 'Customer 360°',
    short: 'Termin im Gewerbegebiet Süd. Pünktlich sein, sauber einparken, Fragen mit itmX beantworten.',
    brief: {
      k: ['Frau Spindler von Fräsfix Maschinenbau hat in 110 Sekunden Zeit für uns. Gewerbegebiet Süd. Pünktlich sein, in die Besucherbox einparken und dann überzeugen!'],
      i: ['Fräsfix! Frau Spindler hasst Unpünktlichkeit mehr als Papierlisten. 110 Sekunden. Und park ordentlich, die schauen vom Büro aus zu.']
    },
    quiz: [
      { q: 'Frau Spindler: „Unsere Techniker wissen beim Kunden nie, was zuletzt passiert ist. Was hilft?“',
        a: ['Customer 360° mit Historie, Ansprechpartnern und Finanzdaten in Echtzeit aus SAP', 'Ein dickerer Aktenordner im Kofferraum', 'Vor jedem Termin den Innendienst anrufen'], ok: 0 },
      { q: 'Frau Spindler: „Und wie planen wir unsere Servicetechniker?“',
        a: ['Per Zuruf in der Kaffeeküche', 'Disposition per Drag & Drop nach Qualifikation, Ort und Verfügbarkeit', 'Mit einer Excel-Liste, die jeder bearbeiten darf'], ok: 1 },
      { q: 'Frau Spindler: „Brauchen wir dafür eine Schnittstelle zu unserem SAP?“',
        a: ['Ja, drei Stück, und ein Projekt über zwei Jahre', 'Nur eine kleine, die nachts synchronisiert', 'Nein, itmX läuft vollständig im SAP, ohne Schnittstellen'], ok: 2 }
    ],
    learn: { icon: '👥', title: 'Customer 360° und Service', text: 'Mit itmX sieht der Außendienst Historie, Ansprechpartner, offene Posten und Kreditlimits in Echtzeit aus SAP, auch offline. Servicetechniker werden per Drag & Drop nach Qualifikation, Ort und Verfügbarkeit disponiert.', video: 'psWPfcfDqQg' },
    win: { k: ['Frau Spindler unterschreibt! 100.000 € für Service und 360°-Sicht.'], i: ['Unterschrieben! Frau Spindler hat sogar gelächelt. Zum ersten Mal seit der letzten Hannover Messe.'] }
  },
  {
    id: 'messe', title: 'Leads auf der Messe Ludlein', place: 'messe', icon: '🎪', reward: 80000, prov: 350, time: 80,
    customer: 'karla', kind: 'collect', count: 10, feature: 'Messeleaderfassung',
    short: 'Fahr zum Messegelände und sammle 10 Leads rund um die Hallen ein, bevor Cloudius sie abgreift.',
    brief: {
      k: ['Karla hier vom Marketing! Auf der Messe Ludlein laufen gerade die Besucher raus. Sammle 10 Leads ein, bevor Cloudius sie abgreift. Mit snapADDY landen sie direkt im CRM.'],
      i: ['Karla hier! Messeende, alle wollen nach Hause. Schnapp dir 10 Leads, bevor Cloudius ihnen seine Wolken-Flyer andreht. Visitenkarten abtippen war gestern!']
    },
    learn: { icon: '🪪', title: 'Messeleads digital erfassen', text: 'Mit der Messeleaderfassung (snapADDY) landen Visitenkarten und Gesprächsnotizen direkt im itmX CRM. Das Leadcockpit verfolgt jeden Lead vom Erstkontakt bis zum Abschluss.', video: 'sFBVWrqOVZ0' },
    win: { k: ['10 Leads im CRM! Daraus macht Sales eine Opportunity über 80.000 €.'], i: ['10 Leads! Cloudius hat nur einen erwischt, und das war sein eigener Praktikant.'] }
  },
  {
    id: 'regalriese', title: 'Reklamation bei Regalriese', place: 'regalriese', icon: '🏬', reward: 140000, prov: 500, time: 95,
    customer: 'palette', kind: 'visit', voice: true, feature: 'Ticket & Besuchsbericht per Sprache',
    short: 'Notfall im Industriepark Ost. Über die Autobahn, unterwegs den Bericht per Sprache erledigen.',
    brief: {
      k: ['Frau Palette von Regalriese ist sauer: eine Lieferung fehlt. Industriepark Ost, über die Autobahn. Du hast 95 Sekunden. Den Bericht diktierst du unterwegs.'],
      i: ['Frau Palette tobt! Die Lieferung ist weg, und das Fax dazu auch. Autobahn, Industriepark Ost, 95 Sekunden. Und wehe, du tippst während der Fahrt!']
    },
    voiceQ: { q: 'Bordcomputer: Besuchsbericht per Sprache. Was soll ich festhalten?',
      a: ['Ticket zur fehlenden Lieferung anlegen, Aufgabe an die Logistik, Rückruf an Frau Palette', 'Nichts, ich merk mir das', 'Alles per Mail an info@ schicken'], ok: 0 },
    quiz: [
      { q: 'Frau Palette: „Wie erfahren wir künftig, wo eine Lieferung steckt, ohne anzurufen?“',
        a: ['Im Self-Service-Portal: Lieferungen und Rechnungen in Echtzeit aus SAP', 'Per Fax-Abruf', 'Gar nicht, das ist Schicksal'], ok: 0 },
      { q: 'Frau Palette: „Und wer kümmert sich bei Ihnen um die Reklamation?“',
        a: ['Wer zuerst die Mail im Sammelpostfach sieht', 'Ein Ticket mit klarer Zuständigkeit, lückenlos nachvollziehbar', 'Der Praktikant, wenn er Zeit hat'], ok: 1 }
    ],
    learn: { icon: '🎫', title: 'Reklamationen und Besuchsberichte', text: 'Reklamationen laufen in itmX als Ticket mit klarer Zuständigkeit. Den Besuchsbericht sprichst du einfach ein, die KI strukturiert ihn und legt Aufgaben an. Kunden sehen Lieferungen und Rechnungen im Self-Service-Portal.', video: 'HPb87hK9uHk' },
    win: { k: ['Reklamation gelöst, Frau Palette ist begeistert und bestellt das Portal: 140.000 €!'], i: ['Gerettet! Frau Palette hat die Brieftaube entlassen und bestellt das Portal. 140.000 €!'] }
  },
  {
    id: 'rennen', title: 'Ampelrennen gegen Cloudius', place: 'racestart', icon: '🚦', reward: 180000, prov: 700, time: 0,
    customer: 'kelle', kind: 'race', feature: 'Objektverfolgung',
    short: 'Mörtelmeister will heute unterschreiben. Wer zuerst dort ist, bekommt den Deal. Tempolimits gelten, Blitzer disqualifizieren!',
    brief: {
      k: ['Herr Kelle von Mörtelmeister unterschreibt heute, aber nur bei dem, der zuerst da ist. Cloudius wartet schon an der Ampel am Silo-Tower. Fahr hin. Achtung: Wer geblitzt wird, ist raus!'],
      i: ['Showdown! Cloudius steht am Silo-Tower an der Ampel und poliert seine Wolke. Wer zuerst bei Mörtelmeister ist, kriegt den Deal. Und Blitzer heißt raus, wir sind ja nicht bei Cloudius!']
    },
    learn: { icon: '🏗️', title: 'Objektverfolgung im Bau', text: 'Mit der Objektverfolgung erkennen Bauzulieferer Projekte früh, behalten Submissionstermine und alle Beteiligten im Blick und sprechen Planer, Verarbeiter und Händler gezielt an. Die KI-Anfrageanalyse wertet lange Leistungsverzeichnisse aus.', video: '6LWzpgdhjtY' },
    win: { k: ['Erster! Herr Kelle unterschreibt bei uns: 180.000 € für Objektverfolgung und mobiles CRM.'], i: ['Erster! Cloudius steckt noch im Synchronisieren fest. Herr Kelle unterschreibt: 180.000 €!'] }
  }
];
export const missionById = (id) => MISSIONS.find((m) => m.id === id);
export const QUOTA = MISSIONS.reduce((s, m) => s + m.reward, 0); // 500.000 €

export const MISSION_LINES = {
  arrive: { k: ['Pünktlich! Jetzt in die leuchtende Besucherbox einparken und anhalten.'], i: ['Da! Rein in die Box. Und nicht wieder schräg wie letztes Mal.'] },
  late: { k: ['Zu spät. Der Termin ist geplatzt. Probier es gleich nochmal.'], i: ['Zu spät! Frau Spindler hat schon die Tür abgeschlossen. Nochmal!'] },
  wrong: { k: ['Hm, das überzeugt nicht ganz.'], i: ['Autsch. Das war die Cloudius-Antwort.'] },
  right: { k: ['Genau so!', 'Sehr gut!', 'Überzeugt!'], i: ['Zack, sitzt!', 'Volltreffer!', 'Wie aus dem Lehrbuch!'] },
  lead: ['Lead!', 'Visitenkarte!', 'Neuer Kontakt!', 'Interessent!'],
  collectTimeout: { k: ['Die Messe ist leer. Zu wenige Leads. Versuch es nochmal!'], i: ['Messe zu, Leads weg. Cloudius verteilt schon Wolken-Flyer. Nochmal!'] },
  raceReady: { k: ['Stell dich neben Cloudius an die Haltelinie und halte an.'], i: ['Neben Cloudius an die Linie. Nicht hupen, er erschrickt so leicht.'] },
  raceGo: { k: ['GRÜN! Los!'], i: ['GRÜN! Gib ihm!'] },
  raceBlitz: { k: ['Geblitzt! Damit bist du disqualifiziert. Cloudius bekommt den Deal. Nochmal, und diesmal mit Tempolimit!'], i: ['Geblitzt! Disqualifiziert! Cloudius lacht so laut, dass seine Wolke wackelt. Nochmal!'] },
  raceLost: { k: ['Cloudius war schneller. Herr Kelle unterschreibt bei ihm. Revanche?'], i: ['Cloudius war zuerst da. Herr Kelle hat jetzt ein CRM aus der Wolke. Mit Schnittstellen. Revanche!'] },
  cloudiusTaunt: {
    k: ['Cloudius: „Meine Wolke ist schneller als dein SAP!“', 'Cloudius: „Bis gleich bei Herrn Kelle. Oder auch nicht.“'],
    i: ['Cloudius: „Schnittstellen? Hab ich im Kofferraum. Irgendwo.“', 'Cloudius: „Ich fahr nur ein bisschen zu schnell. In der Cloud gibts keine Blitzer.“', 'Cloudius: „Deine Daten gehören bald MIR!“']
  },
  cloudiusLag: { k: ['Cloudius: „Moment … synchronisiere … 47 % …“'], i: ['Cloudius: „Moment, Update wird installiert … bitte Fahrzeug nicht ausschalten …“'] },
  abort: { k: ['Auftrag abgebrochen. Du kannst ihn jederzeit neu starten.'], i: ['Abgebrochen. Kein Stress, das Quartal hat ja noch ein paar Minuten.'] }
};

// tempo limits in km/h
export const LIMIT = { city: 50, zone30: 30, land: 70, baustelle: 120, frei: Infinity };
export const BLITZ_FINE = 50;

export const fmtEuro = (n) => `${Math.round(n).toLocaleString('de-DE')} €`;
