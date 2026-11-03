// Content for "Das CRM-Königreich": a floating block island where you mine resources,
// trade with the module traders and build the ideal CRM castle on an SAP foundation.
// Every text pool has a polite part `k` (customers & partners) and an optional internal part `i`.
// Product facts come from itmx.de (itmX crm suite: marketing, sales, service, commerce).

import { storeGet, storeSet } from '../../core/ui.js';

export const MODE_KEY = 'crm-mode';
export const getMode = () => (storeGet(MODE_KEY, 'kunde') === 'intern' ? 'intern' : 'kunde');
export const setMode = (m) => storeSet(MODE_KEY, m === 'intern' ? 'intern' : 'kunde');

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

export function say(pool, mode = getMode()) {
  if (!pool) return '';
  if (typeof pool === 'string') return pool;
  if (Array.isArray(pool)) return pick(pool);
  if (mode === 'intern' && pool.i?.length && (Math.random() < 0.75 || !pool.k?.length)) return pick(pool.i);
  return pick(pool.k);
}

// ------------------------------------------------------------------ the song after the game (made with Suno)
import { songById } from '../../core/songs.js';
const S = songById('system-overload');
export const SONG = { url: S.src, cover: S.cover, title: S.title };

// ------------------------------------------------------------------ timing: 3 days, 3 nights
export const DAYS = [
  { day: 56, night: 22 },
  { day: 50, night: 26 },
  { day: 46, night: 32 }
];
export const TOTAL_TIME = DAYS.reduce((s, d) => s + d.day + d.night, 0);

// ------------------------------------------------------------------ resources
export const RES = {
  sap: { id: 'sap', name: 'SAP-Erz', icon: '🔷', color: '#3d8bff', hint: 'Stammdaten-Erz aus dem Felsen im Westen' },
  data: { id: 'data', name: 'Kundendaten', icon: '💎', color: '#3ddc84', hint: 'Kristalle in der Datenmine im Osten' },
  lead: { id: 'lead', name: 'Leads', icon: '🌟', color: '#ffcc4d', hint: 'Goldene Früchte an den Lead-Bäumen' }
};
export const RES_IDS = ['sap', 'data', 'lead'];

// ------------------------------------------------------------------ modules = the four towers
export const MODULES = {
  mkt: { id: 'mkt', name: 'Marketing', color: '#ff5fa8', tower: 0 },
  sal: { id: 'sal', name: 'Sales', color: '#19c3ff', tower: 1 },
  svc: { id: 'svc', name: 'Service', color: '#ffb000', tower: 2 },
  com: { id: 'com', name: 'Commerce', color: '#a46bff', tower: 3 },
  core: { id: 'core', name: 'Kern', color: '#50af30', tower: -1 }
};
export const TOWER_MODS = ['mkt', 'sal', 'svc', 'com'];

// Feature blocks. cost: resources. tag: text on the block faces.
export const FEATURES = [
  // ---- Marketing
  { id: 'kampagne', mod: 'mkt', name: 'Kampagnenmanagement', tag: 'KAMP', icon: '📣', cost: { lead: 3, data: 1 }, desc: 'Zielgruppen direkt aus SAP-Daten selektieren.' },
  { id: 'leadcockpit', mod: 'mkt', name: 'Leadcockpit', tag: 'LEAD', icon: '🎯', cost: { lead: 3 }, desc: 'Leads vom Erstkontakt bis zum Abschluss verfolgen.' },
  { id: 'automation', mod: 'mkt', name: 'Marketing Automation', tag: 'AUTO', icon: '🤖', cost: { lead: 3, data: 1 }, desc: 'Lead Nurturing mit personalisierten Inhalten, powered by Evalanche.' },
  { id: 'event', mod: 'mkt', name: 'Eventmanagement', tag: 'EVENT', icon: '🎪', cost: { lead: 2, data: 1 }, desc: 'Von der Einladung bis zum Follow-up.' },
  { id: 'messe', mod: 'mkt', name: 'Messeleaderfassung', tag: 'MESSE', icon: '🪪', cost: { lead: 3 }, desc: 'Messekontakte digital erfassen, direkt ins CRM (snapADDY).' },
  { id: 'segment', mod: 'mkt', name: 'Segmentierung', tag: 'SEGM', icon: '🧩', cost: { data: 3, lead: 1 }, desc: 'Präzise Zielgruppen mit flexiblen Filtern.' },
  // ---- Sales
  { id: 'kontakt', mod: 'sal', name: 'Customer 360°', tag: '360°', icon: '👥', cost: { data: 3 }, desc: 'Ansprechpartner, Historie, Kreditlimit und Finanzdaten in Echtzeit aus SAP.' },
  { id: 'opportunity', mod: 'sal', name: 'Opportunity Management', tag: 'OPP', icon: '🤝', cost: { data: 2, lead: 1 }, desc: 'Vertriebschancen von der Anfrage bis zum Abschluss steuern.' },
  { id: 'pipeline', mod: 'sal', name: 'Pipeline & Forecast', tag: 'PIPE', icon: '📈', cost: { data: 2, lead: 1 }, desc: 'Deals nach Phase und Wahrscheinlichkeit, belastbare Forecasts.' },
  { id: 'angebot', mod: 'sal', name: 'Angebot mit SAP-Daten', tag: 'ANGEB', icon: '📄', cost: { sap: 3, data: 1 }, desc: 'Artikel, Preise und Konditionen kommen automatisch aus SAP.' },
  { id: 'voice', mod: 'sal', name: 'Besuchsbericht per Sprache', tag: 'VOICE', icon: '🎙️', cost: { data: 2, lead: 1 }, desc: 'Einsprechen, die KI strukturiert den Bericht und legt Aufgaben an.' },
  { id: 'mobil', mod: 'sal', name: 'Mobiles CRM (offline)', tag: 'MOBIL', icon: '📱', cost: { sap: 2, data: 1 }, desc: 'Auch ohne Netz auskunftsfähig beim Kunden.' },
  { id: 'objekt', mod: 'sal', name: 'Objektverfolgung', tag: 'OBJEKT', icon: '🏗️', cost: { data: 3, lead: 1 }, desc: 'Bauprojekte früh erkennen, Submissionstermine und Karte im Blick.' },
  { id: 'besuch', mod: 'sal', name: 'Besuchsplanung & Storecheck', tag: 'TOUR', icon: '🗺️', cost: { data: 2, lead: 1 }, desc: 'Potenzialgetriebene Wochenplanung mit Kartenansicht.' },
  // ---- Service
  { id: 'ticket', mod: 'svc', name: 'Ticket & Reklamation', tag: 'TICKET', icon: '🎫', cost: { sap: 2, data: 1 }, desc: 'Vom Eingang bis zur Lösung lückenlos nachvollziehbar.' },
  { id: 'dispo', mod: 'svc', name: 'Disposition Techniker', tag: 'DISPO', icon: '🗓️', cost: { sap: 3 }, desc: 'Qualifikation, Ort, Verfügbarkeit: Einsätze per Drag & Drop planen.' },
  { id: 'field', mod: 'svc', name: 'Field Service App', tag: 'FIELD', icon: '🔧', cost: { sap: 2, data: 1 }, desc: 'Offline-fähig, Servicebericht mit digitaler Unterschrift.' },
  { id: 'ersatz', mod: 'svc', name: 'Ersatzteilmanagement', tag: 'TEILE', icon: '⚙️', cost: { sap: 3, data: 1 }, desc: 'Verfügbarkeit, Stücklisten und Explosionszeichnung im Blick.' },
  { id: 'iot', mod: 'svc', name: 'Predictive Service (IoT)', tag: 'IoT', icon: '📡', cost: { sap: 2, data: 2 }, desc: 'Maschinen melden sich, bevor sie ausfallen.' },
  { id: 'postfach', mod: 'svc', name: 'Sammelpostfach-Workflow', tag: 'INBOX', icon: '📬', cost: { data: 2, lead: 1 }, desc: 'info@ und service@ als sauberer Workflow mit klarer Zuständigkeit.' },
  // ---- Commerce
  { id: 'shop', mod: 'com', name: 'B2B-Webshop', tag: 'SHOP', icon: '🛒', cost: { sap: 3, lead: 1 }, desc: 'Webshop auf Echtzeitdaten aus SAP ECC oder S/4HANA.' },
  { id: 'portal', mod: 'com', name: 'Self-Service-Portal', tag: 'PORTAL', icon: '🚪', cost: { sap: 2, data: 1 }, desc: 'Kunden sehen Lieferungen, Rechnungen und bestellen selbst.' },
  { id: 'explosion', mod: 'com', name: 'Teile aus Explosionszeichnung', tag: 'EXPLO', icon: '💥', cost: { sap: 3, data: 1 }, desc: 'Ersatzteile direkt aus der Zeichnung bestellen.' },
  { id: 'haendler', mod: 'com', name: 'Händlerportal', tag: 'PARTNER', icon: '🏬', cost: { sap: 2, lead: 1 }, desc: 'Beliebig viele Shops in einem System, B2B2C und B2R.' },
  { id: 'pim', mod: 'com', name: 'PIM & Produktinfos', tag: 'PIM', icon: '🏷️', cost: { sap: 3 }, desc: 'Transparente Produktinformationen in Echtzeit.' },
  { id: 'katalog', mod: 'com', name: 'Mobiler Produktkatalog', tag: 'KATALOG', icon: '📚', cost: { sap: 2, lead: 1 }, desc: 'Produkte präsentieren und Aufträge erfassen, auch offline.' },
  // ---- Core (itmX-Schmiede)
  { id: 'fundament', mod: 'core', name: 'SAP-Fundament', tag: 'SAP', icon: '🧱', cost: { sap: 3 }, multi: 4, desc: 'Vollständig in SAP ECC oder S/4HANA integriert, ohne Schnittstellen. Trägt einen Turm.' },
  { id: 'm365', mod: 'core', name: 'Microsoft-365-Brücken', tag: 'M365', icon: '🌉', cost: { sap: 1, data: 1, lead: 1 }, desc: 'Outlook-Add-in, Teams und Freigaben per Power Automate verbinden alle Türme.' },
  { id: 'ki', mod: 'core', name: 'KI-Kristall', tag: 'KI', icon: '🔮', cost: { data: 2, lead: 1 }, desc: 'KI-Assistent, Anfrageanalyse, Übersetzung und Emotionserkennung. Schießt nachts Blitze.' },
  { id: 'bi', mod: 'core', name: 'Power-BI-Banner', tag: 'BI', icon: '📊', cost: { sap: 1, data: 1 }, desc: 'KPI-Dashboards für Marketing, Sales und Service, rollenbasiert.' }
];
export const featureById = (id) => FEATURES.find((f) => f.id === id);

// ------------------------------------------------------------------ traders
export const TRADERS = [
  { id: 'mkt', mod: 'mkt', name: 'Kampagnen-Karla', role: 'Marketing-Händlerin', swap: { give: { data: 1 }, get: { lead: 2 } },
    hello: { k: ['Leads, Kampagnen, Events! Was darf es sein?', 'Ich mache aus Klicks echte Pipeline.'], i: ['Leads frisch vom Baum! Nur halb so viele sind Spam wie letztes Jahr.', 'Marketing ist nicht nur bunte Bildchen. Sagt auch keiner mehr, seit wir Umsatz messen.'] } },
  { id: 'sal', mod: 'sal', name: 'Deal-Dieter', role: 'Sales-Händler', swap: { give: { lead: 2 }, get: { data: 1 } },
    hello: { k: ['Mit der 360°-Sicht weiß ich mehr über den Kunden als er selbst.', 'Angebote mit SAP-Preisen, keine Abschreibfehler mehr.'], i: ['Forecast? Steht im CRM. Nicht mehr auf meinem Bierdeckel.', 'Ich verkaufe dir sogar Kühlschränke am Nordpol. Aber lieber Pipeline Management.'] } },
  { id: 'svc', mod: 'svc', name: 'Schrauber-Sven', role: 'Service-Händler', swap: { give: { data: 2 }, get: { sap: 1 } },
    hello: { k: ['Techniker disponieren, Ersatzteile finden, Bericht unterschreiben lassen.', 'Guter Service macht aus Kunden Fans.'], i: ['Servicebericht auf Papier? Hab ich zuletzt mit Kaffeefleck abgegeben. 2014.', 'Ich repariere alles. Außer Excel-Makros. Da hilft nur Feuer.'] } },
  { id: 'com', mod: 'com', name: 'Shop-Shirin', role: 'Commerce-Händlerin', swap: { give: { lead: 2 }, get: { sap: 1 } },
    hello: { k: ['Webshop und Kundenportal, direkt auf SAP-Daten.', 'Self-Service rund um die Uhr, auch nachts um drei.'], i: ['Bestellungen per Fax? Das Gerät steht jetzt im Museum. Neben dem Diskettenlaufwerk.', 'Mein Shop hat mehr Echtzeit als die Bahn-App.'] } },
  { id: 'core', mod: 'core', name: 'Schmied Xaver', role: 'itmX-Schmiede', swap: null,
    hello: { k: ['Hier wird das SAP-Fundament geschmiedet. Und Altlasten werden umgetauscht.', 'Bring mir Legacy-Schrott, ich mach dir was Ordentliches draus.'], i: ['Gib her, den Excel-Krempel. Ich schmelz das ein.', 'Sammelpostfach? Kommt ins Feuer. Sauber.'] } }
];
export const traderById = (id) => TRADERS.find((t) => t.id === id);

// ------------------------------------------------------------------ legacy junk on the island and what the forge makes of it
export const LEGACY = [
  { id: 'excel', name: 'Excel-Liste', icon: '📗', color: '#1f8f4e', to: 'bi', extra: { data: 1 }, line: 'Aus der Excel-Liste wird ein Power-BI-Banner. Exceln Sie noch, oder Power-BI-en Sie schon?' },
  { id: 'postfach', name: 'Sammelpostfach', icon: '📨', color: '#d9d2bf', to: 'postfach', extra: { data: 1 }, line: 'Kein Status-Chaos mehr: Das Sammelpostfach wird zum Workflow.' },
  { id: 'papier', name: 'Papier-Besuchsbericht', icon: '📝', color: '#f4efe0', to: 'voice', extra: { lead: 1 }, line: 'Nie wieder abtippen: Besuchsbericht per Sprache.' },
  { id: 'access', name: 'Access-Datenbank', icon: '🗄️', color: '#a4373a', to: 'fundament', extra: { sap: 1 }, line: 'Schluss mit Schatten-Datenbanken: Single Source of Truth im SAP.' },
  { id: 'insel', name: 'Insel-CRM', icon: '🏝️', color: '#7a8a9e', to: 'kontakt', extra: { data: 1 }, line: 'Von der Insellösung zum integrierten CRM mit 360°-Sicht.' },
  { id: 'fax', name: 'Bestellfax', icon: '📠', color: '#cfc5a8', to: 'portal', extra: { sap: 1 }, line: 'Bestellfax adé: Kunden bestellen im Self-Service-Portal.' }
];
export const legacyById = (id) => LEGACY.find((l) => l.id === id);

// ------------------------------------------------------------------ the rival
export const RIVAL = {
  name: 'Cloudius von Silo',
  role: 'Fremd-CRM-Händler',
  hello: {
    k: ['Psst! Features zum halben Preis. Integration? Kommt später, ganz bestimmt.', 'Warum ein Fundament, wenn man auch auf Wolken bauen kann?'],
    i: ['Schnittstellen verbinde ich nächstes Quartal. Oder übernächstes. Versprochen.', 'Deine Daten? Liegen sicher. Irgendwo. Bei mir. Glaube ich.', 'Lizenz pro Klick, Support pro Seufzer. Ein Schnäppchen!']
  },
  warn: 'Fremd-Block: zählt nur halb für den Bauplan, wackelt ohne SAP-Anbindung und lockt nachts Monster an.'
};

// ------------------------------------------------------------------ customers (fictional), one per day
export const CUSTOMERS = [
  {
    id: 'maschinenbau', name: 'Fräsfix Maschinenbau GmbH', who: 'Frau Spindler, Leitung Service', branche: 'Maschinen- und Anlagenbau', icon: '🏭', color: '#19c3ff',
    wishes: ['kontakt', 'angebot', 'dispo', 'field', 'explosion'],
    hello: { k: ['Unsere Anlagen laufen weltweit. Wir brauchen Service, der mitdenkt, und Angebote ohne Abtippen.'], i: ['Unsere Techniker fahren mit Papierlisten zum Kunden. Und kommen manchmal mit der falschen Dichtung zurück.'] }
  },
  {
    id: 'bau', name: 'Mörtelmeister Baustoffe AG', who: 'Herr Kelle, Vertriebsleiter', branche: 'Bau und Bauzulieferer', icon: '🏗️', color: '#ffb000',
    wishes: ['objekt', 'mobil', 'ki', 'automation', 'm365'],
    hello: { k: ['Wir müssen Bauprojekte früh erkennen und Planer, Verarbeiter und Händler gezielt ansprechen.'], i: ['Unsere Leistungsverzeichnisse haben 400 Seiten. Gelesen hat sie zuletzt der Praktikant. Glaube ich.'] }
  },
  {
    id: 'handel', name: 'Regalriese Großhandel KG', who: 'Frau Palette, Geschäftsführung', branche: 'Handel', icon: '🏬', color: '#a46bff',
    wishes: ['haendler', 'shop', 'besuch', 'bi', 'ticket'],
    hello: { k: ['Unsere Händler wollen rund um die Uhr bestellen, und unser Außendienst braucht die Zahlen sofort.'], i: ['Reklamationen kommen bei uns per Fax, Mail, Telefon und Brieftaube. Die Taube ist am zuverlässigsten.'] }
  }
];

// ------------------------------------------------------------------ night monsters
export const MONSTERS = {
  excel: { name: 'Excel-Zombie', hp: 4, speed: 1.5, pts: 40, size: 1, lines: { k: ['#BEZUG!', 'SVERWEIS …', '#WERT!', 'Version_final_v7.xlsx'], i: ['Wer hat meine Makros gelöscht?!', '#NV #NV #NV', 'Ich bin die einzige Wahrheit!'] } },
  postfach: { name: 'Sammelpostfach-Krabbler', hp: 2, speed: 2.7, pts: 40, size: 0.8, lines: { k: ['AW: AW: WG: AW:', 'Wer ist zuständig?', 'Bitte um Rückmeldung!'], i: ['Ich hab dich mal in CC gesetzt.', 'DRINGEND!!! (seit 2019)'] } },
  silo: { name: 'Datensilo-Golem', hp: 11, speed: 0.85, pts: 120, size: 1.5, lines: { k: ['Meine Daten gehören MIR!', 'Kein Zugriff!'], i: ['Teilen? Nur gegen Formular in dreifacher Ausfertigung.', 'Ich bin ein Silo. Ich mag keine Menschen.'] } },
  ghost: { name: 'Schatten-IT-Gespenst', hp: 4, speed: 1.8, pts: 60, size: 1, fly: true, lines: { k: ['Buuuh … ohne Freigabe!', 'Ich bin gar nicht da …'], i: ['Ich laufe auf Kevins privatem Laptop.', 'Buuuh! Selbstgebautes Tool!'] } },
  boss: { name: 'Der Medienbruch', hp: 60, speed: 0.55, pts: 1200, size: 3, boss: true, lines: { k: ['ICH BIN DER MEDIENBRUCH! Ich tippe alles dreimal ab!', 'Ausdrucken, abtippen, einscannen!'], i: ['ICH BIN DER MEDIENBRUCH! Copy & Paste ist mein Kardio!', 'Fax, Mail, Excel, Fax! Hahaha!'] } }
};
// waves per night: [type, count]
export const NIGHTS = [
  [['excel', 8], ['postfach', 5]],
  [['excel', 8], ['postfach', 6], ['ghost', 4], ['silo', 2]],
  [['excel', 9], ['postfach', 7], ['ghost', 5], ['silo', 3], ['boss', 1]]
];

// ------------------------------------------------------------------ Lord CRM
export const LORD = {
  name: 'Lord CRM',
  intro: {
    k: ['Willkommen in meinem Königreich! Bau mir das ideale CRM: ein festes SAP-Fundament und vier starke Türme für Marketing, Sales, Service und Commerce.'],
    i: ['Willkommen in meinem Königreich! Es besteht zu 80 % aus Excel und zu 20 % aus Hoffnung. Bau mir ein CRM, das den Namen verdient.']
  },
  dayStart: [
    { k: ['Der erste Tag bricht an! Erz abbauen, handeln, bauen!'], i: ['Tag eins! Spitzhacke raus, Ausreden weg!'] },
    { k: ['Ein neuer Morgen und ein neuer Kunde. An die Arbeit!'], i: ['Tag zwei. Der Kaffee ist stark, die Excel-Zombies sind schwach. Los!'] },
    { k: ['Der letzte Tag! Danach kommt die längste Nacht.'], i: ['Letzter Tag! Heute Nacht kommt der Medienbruch. Ich hab schon die Ritterrüstung gebügelt.'] }
  ],
  dusk: { k: ['Die Sonne geht unter. Händler schließen. Gleich kommen die Legacy-Monster!'], i: ['Dämmerung! Die Excel-Zombies kriechen aus ihren Ordnern. Halt die Burg!'] },
  night: { k: ['Monster antippen! Jeder Turm verteidigt sich selbst, je höher, desto stärker.'], i: ['Hau drauf! Und keine Sorge, die Monster haben keinen Betriebsrat.'] },
  dawn: { k: ['Die Nacht ist vorbei. Das Königreich steht!'], i: ['Morgen! Die Monster sind weg, nur der Geruch von altem Toner bleibt.'] },
  built: { k: ['Prächtig! Ein neuer Block für mein CRM.', 'So wächst ein Königreich.', 'Das Volk jubelt!'], i: ['Schick! Viel schöner als meine Pivot-Tabellen.', 'Noch so ein Block und ich kündige mein Excel-Abo.', 'Der Hofnarr ist neidisch.'] },
  fundament: { k: ['Ein SAP-Fundament! Darauf steht ein Turm sicher, ganz ohne Schnittstellen.'], i: ['SAP-Fundament! Hält bombenfest. Im Gegensatz zu Kevins Schnittstelle.'] },
  wobbly: { k: ['Vorsicht! Ohne SAP-Fundament wackelt der Turm.'], i: ['Ein Turm ohne Fundament? Das ist wie ein Forecast ohne Daten.'] },
  foreign: { k: ['Ein Fremd-Block von Cloudius? Hm. Der hält doch keine Nacht.'], i: ['Ein Fremd-Block?! Den hat bestimmt ein Praktikant per Copy & Paste angeschlossen.'] },
  stolen: { k: ['Ein Monster hat einen Block geklaut!'], i: ['Die haben mir einen Block geklaut! Das melde ich dem Datenschutz!'] },
  held: { k: ['Das SAP-Fundament hält stand!'], i: ['Abgeprallt! SAP-Fundament, Baby!'] },
  boss: { k: ['Der Medienbruch! Mit allen Türmen dagegenhalten!'], i: ['Oh nein, der Medienbruch! Ich hab schon wieder Druckerpapier im Bart.'] },
  bossDown: { k: ['Der Medienbruch ist besiegt! Ab jetzt fließen die Daten durchgängig.'], i: ['Der Medienbruch liegt am Boden! Wir digitalisieren seine Überreste.'] },
  customerHappy: { k: ['Der Kunde ist begeistert! Alle Wünsche erfüllt.'], i: ['Alle Wünsche erfüllt! Der Kunde will mich umarmen. Bitte nicht, die Krone.'] },
  legacy: { k: ['Altlast entsorgt! Bring sie zur Schmiede, Xaver macht was daraus.'], i: ['Weg mit dem Gerümpel! Xaver heizt schon die Esse an.'] },
  poor: { k: ['Dafür fehlen noch Rohstoffe. Erz abbauen, Kristalle schlagen, Leads pflücken!'], i: ['Zu wenig im Säckel! Ab in die Mine.'] }
};

// Lord CRM's look (voxel king)
export const LORD_LOOK = { robe: '#b3122e', trim: '#f6f1e6', crown: '#ffcc33', beard: '#e9e4da', skin: '#f0c49a', gem: '#50af30' };

// ------------------------------------------------------------------ scoring & ranks
export const PTS = { mine: 10, build: 100, wish: 250, happy: 400, legacy: 60, lost: -80, fundamentAll: 800, pillars: 600, pure: 500 };
export const RANKS = [
  { id: 'gold', name: 'Gold', min: 12000, title: 'Großmeister:in des CRM', line: 'Ein Königreich, von dem andere nur träumen.' },
  { id: 'silber', name: 'Silber', min: 8000, title: 'Ritter:in der 360°-Sicht', line: 'Starke Türme, zufriedene Kunden.' },
  { id: 'bronze', name: 'Bronze', min: 4000, title: 'Baumeister:in des Reiches', line: 'Das Fundament steht, der Rest wächst.' },
  { id: 'teilnahme', name: 'Teilnahme', min: 0, title: 'Knappe des CRM', line: 'Jede Burg fängt mit einem Block an.' }
];
export const rankFor = (pts) => RANKS.find((r) => pts >= r.min) || RANKS[RANKS.length - 1];

// ------------------------------------------------------------------ learning cards (facts from itmx.de)
export const LEARN = [
  { id: 'sap', icon: '🧱', title: 'Schnittstellenfrei in SAP', text: 'Die itmX crm suite ist vollständig in SAP ECC und SAP S/4HANA integriert. Kundendaten, Angebote und Aufträge kommen direkt aus SAP, ohne Schnittstellen und ohne Datenreplikation. Für S/4HANA ist sie von SAP zertifiziert.', video: 'kSDGEH8Dbm8' },
  { id: '360', icon: '👥', title: '360°-Sicht in Echtzeit', text: 'Aktivitätshistorie, Ansprechpartner, Verkaufschancen, Kreditlimits sowie Zahlungs- und Finanzdaten stehen in Echtzeit bereit, im Innen- und Außendienst, online wie offline.', video: 'psWPfcfDqQg' },
  { id: 'mkt', icon: '📣', title: 'itmX marketing', text: 'Kampagnenmanagement mit Zielgruppen aus SAP-Daten, Leadcockpit entlang der Customer Journey, Marketing Automation powered by Evalanche und Marketing Controlling mit Power BI.', video: 'sFBVWrqOVZ0' },
  { id: 'sal', icon: '🤝', title: 'itmX sales', text: 'Ansprechpartner-, Opportunity-, Aktivitäten- und Pipeline-Management, Angebote direkt mit SAP-Preisen und Konditionen, Messeleads per snapADDY und mobiles CRM, auch offline.', video: 'HXTr7IgqUgA' },
  { id: 'svc', icon: '🔧', title: 'itmX service', text: 'Disposition der Servicetechniker per Drag & Drop, offline-fähige Field-Service-App mit digitaler Unterschrift, Ersatzteilmanagement mit Stücklisten und Explosionszeichnung, B2B-Kundenserviceportal.', video: 'HPb87hK9uHk' },
  { id: 'com', icon: '🛒', title: 'itmX commerce', text: 'Webshop für B2B und B2C auf Echtzeitdaten aus SAP, integriertes PIM, Self-Service-Portal für Lieferungen und Rechnungen, Händlerportal mit beliebig vielen Shops in einem System.', video: '2ux_c7V74WI' },
  { id: 'm365', icon: '🌉', title: 'CRM dort, wo man arbeitet', text: 'Mit dem Outlook-Add-in officeXperience, webXperience in Microsoft Teams und Freigaben per Power Automate bleiben CRM-Daten im Arbeitskontext, ohne Systemwechsel und Doppelerfassung.', video: 'N1SjeJRSk7c' },
  { id: 'ki', icon: '🔮', title: 'KI im CRM', text: 'Besuchsberichte per Sprache mit automatisch angelegten Aufgaben, Emotionserkennung in E-Mails, KI-Übersetzung aller CRM-Daten und KI-Anfrageanalyse für umfangreiche Leistungsverzeichnisse.', video: 'buiHRyg9lmE' },
  { id: 'legacy', icon: '📨', title: 'Altlasten kosten Zeit', text: 'Sammelpostfächer ohne Workflow führen zu Status-Chaos, doppelter Bearbeitung und verlorenen Anfragen. Insellösungen und Excel-Listen verteilen Kundenwissen auf viele Orte.', video: null },
  { id: 'branchen', icon: '🏭', title: 'Fokusbranchen', text: 'itmX ist auf Maschinen- und Anlagenbau, Bau und Bauzulieferer sowie Handel spezialisiert. Jede Branche braucht andere Bausteine, die Basis bleibt das integrierte SAP-Fundament.', video: '6LWzpgdhjtY' }
];

// ------------------------------------------------------------------ finale lines
export const FINALE = {
  speaker: 'Lord CRM · Herrscher des Königreichs',
  intro: { k: ['Tritt näher, Baumeister:in! Ich habe dein Werk von meinem Thron aus gesehen.'], i: ['Tritt näher! Und keine Angst, ich beiße nur Excel-Zombies.'] },
  rank: {
    gold: { k: ['Ein CRM wie aus dem Bilderbuch: festes Fundament, vier stolze Türme und begeisterte Kunden!'], i: ['Mein Hofnarr ist sprachlos. Zum ersten Mal seit 1998.'] },
    silber: { k: ['Starke Türme, zufriedene Kunden. Das Königreich ist in guten Händen.'], i: ['Fast perfekt! Nur ein paar Excel-Zombies erzählen noch von früher.'] },
    bronze: { k: ['Das Fundament steht, und darauf lässt sich weiterbauen.'], i: ['Es steht! Wackelt ein bisschen, aber es steht.'] },
    teilnahme: { k: ['Jede große Burg begann mit einem einzigen Block. Morgen baust du weiter!'], i: ['Nun ja. Die Monster hatten Spaß. Aber du hast durchgehalten!'] }
  },
  knight: 'Knie nieder! Kraft meiner Krone schlage ich dich zum Ritter des CRM.',
  hand: (title) => `Erhebe dich als ${title}! Hier ist deine königliche Urkunde.`
};
