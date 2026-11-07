// Texte, Einsätze, Werkzeuge und Ränge für das Bonusspiel „Frag den Danny!“.
// Schwarzer Humor ausdrücklich erwünscht. Alles frei erfunden, Ähnlichkeiten mit
// real existierenden Beratern sind rein zufällig und trotzdem verdient.

export const GAME_TIME = 180; // eine Schicht: 3 Minuten bis Feierabend
export const STAGE_LEN = 36; // alle 36 s steigt die Alarmstufe

export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

/** Danny's Werkzeugkoffer */
export const TOOLS = [
  { id: 'foam', key: '1', icon: '🧯', name: 'Löscher', short: 'Löscher', desc: 'Schaum auf alles, was brennt. Und auf jeden, der nervt.' },
  { id: 'defi', key: '2', icon: '⚡', name: 'Denk-Defi', short: 'Defi', desc: 'Startet eingeschlafene Hirne neu. Nebenwirkung: Frisur.' },
  { id: 'hammer', key: '3', icon: '🔨', name: 'Hard-Reset-Hammer', short: 'Hammer', desc: 'Für SAP-Monolithen und Spaghetti-Code. Funktioniert auch bei Druckern.' },
  { id: 'duck', key: '4', icon: '🦆', name: 'Debug-Ente', short: 'Ente', desc: 'Werfen. Wer der Ente sein Problem erklärt, löst es selbst.' }
];

/**
 * Die Einsatzarten. tool: das passende Werkzeug. limit: Sekunden, bis aus dem Problem ein Brand wird.
 */
export const PROBLEMS = {
  faul: {
    label: 'Berater denkt nicht',
    tool: 'defi',
    icon: '💤',
    points: 300,
    limit: 15,
    feed: [
      'Berater im Energiesparmodus. Gehirn seit 09:14 Uhr offline.',
      'Berater zu faul zum Nachdenken. Er wartet, dass das Problem in Rente geht.',
      'Kollege meldet: „Denken ist Aufgabe vom Danny.“'
    ],
    say: [
      'Nachdenken? Dafür werd ich nicht bezahlt. Ich werd fürs Dasitzen bezahlt.',
      'Ich hab heute schon zweimal gedacht. Reicht für die Woche.',
      'Mein Hirn hat Gleitzeit. Kommt so gegen Donnerstag.',
      'Ich lass das mal reifen. Wie Käse. Oder wie eine Leiche.',
      'Wenn ich lang genug nix mach, löst sich das von allein. Hat beim letzten Projekt auch geklappt. Das ist jetzt tot.',
      'Zzz … Danny macht das … zzz …'
    ],
    solved: [
      'AAAAH! Ich hab eine Idee! Ah nee, war nur der Strom.',
      'Ich bin wach! Ich bin wach! Wer hat mir die Haare angezündet?',
      'Okay, okay, ich denk ja schon! Tut weh, aber geht.',
      'Hirn neu gestartet. Bitte 47 Updates installieren.'
    ]
  },
  anforderung: {
    label: 'Neue Anforderung',
    tool: 'foam',
    icon: '📄',
    points: 250,
    limit: 0, // brennt sofort
    feed: [
      'Kunde schickt neue Anforderung. Hat noch nie jemand gehört. Brennt schon.',
      'Lastenheft Seite 847 aufgetaucht. Niemand hat Seite 1 bis 846 gelesen.',
      'Anforderung im Anflug! Der Kunde nennt es „Kleinigkeit“.'
    ],
    say: [
      'Kann das CRM auch Kaffee kochen? Steht so im Lastenheft.',
      'Das war doch immer klar, dass das Angebot in Klingonisch rausgehen muss!',
      'Wir brauchen das Ganze nochmal, aber in Blau. Und bis gestern.',
      'Kleine Änderung: Alles anders. Budget gleich.',
      'Das hab ich doch im Meeting gesagt! Also gedacht. Also geträumt.',
      'Können wir die Pipeline nach Sternzeichen filtern?',
      'Der Vorstand will einen Button, der Umsatz macht.'
    ],
    solved: [
      'Anforderung gelöscht. Wortwörtlich.',
      'Abgelöscht und in den Backlog. Da stirbt sie in Frieden.',
      'Change Request ist nass. Kostet trotzdem extra.'
    ]
  },
  vergessen: {
    label: 'Gestern war heute schon morgen',
    tool: 'defi',
    icon: '🐟',
    points: 300,
    limit: 15,
    feed: [
      'Berater hat vergessen, was er gestern definiert hat. Gestern war heute schon morgen.',
      'Goldfisch-Alarm! Konzept von gestern: spurlos verschwunden.',
      'Definition von gestern weg. Spuren deuten auf Feierabendbier.'
    ],
    say: [
      'Was hab ich gestern definiert? Gestern war heute schon morgen!',
      'Ich hab ein Gedächtnis wie ein Sieb. Nur ohne die Löcher, wo was hängen bleibt.',
      'Das Konzept war genial. Ich weiß nur nicht mehr, worum es ging.',
      'Hab ich das gesagt? Das klingt gar nicht nach mir. Das klingt nach Arbeit.',
      'Mein Gedächtnis ist wie die Doku: gab es nie.',
      'Wer bin ich? Und warum hab ich einen Termin beim Kunden?'
    ],
    solved: [
      'Ah, da ist es wieder! Ich hab es auf einen Bierdeckel geschrieben!',
      'Erinnerung wiederhergestellt. Leider auch die an die Weihnachtsfeier.',
      'Jetzt weiß ich es wieder! Und ich wünschte, ich hätte es vergessen.'
    ]
  },
  frage: {
    label: 'Technische Frage',
    tool: 'duck',
    icon: '❓',
    points: 350,
    limit: 14,
    feed: [
      'Technische Frage im Großraum. Nachdenken wäre möglich, aber: Kein Bock. Frag den Danny.',
      'Kollege schreit DANNY. Frage: Wo ist der Anschalter vom Internet?',
      'Notruf: Jemand müsste nachdenken. Lieber nicht.'
    ],
    say: [
      'DANNY! Kurze Frage! Also, eine lange. Mit Folgefragen.',
      'Ich müsste jetzt nachdenken. Kein Bock. DANNYYY!',
      'DANNY! Warum geht das nicht? Ich hab nix gemacht! Also fast nix.',
      'DANNY! Wie macht man das CRM an? Ich hab schon gegen den Bildschirm geklopft.',
      'DANNY! Ist das ein Bug oder ein Feature? Ich will nur wissen, wen ich anschreien muss.',
      'DANNY! Mein Kopf ist leer. Das war er schon vorher, aber jetzt merke ich es.'
    ],
    solved: [
      'Ich hab der Ente alles erklärt … und es selbst gelöst. Ich bin ein Genie!',
      'Quak. Ich mein: Danke, Ente.',
      'Die Ente hat mehr Ahnung als mein Teamleiter.',
      'Problem erklärt, Problem verstanden, Ente traumatisiert.'
    ]
  },
  code: {
    label: 'Spaghetti-Code',
    tool: 'hammer',
    icon: '🍝',
    points: 400,
    limit: 0,
    feed: [
      'Entwickler unzufrieden mit seinem Quellcode. Der Code lebt jetzt und hat Hunger.',
      'Spaghetti-Code ist aus dem Monitor gekrochen. Al dente und bösartig.',
      'Entwickler hat Code von 2009 aufgemacht. Das hätte er nicht tun sollen.'
    ],
    say: [
      'Wer hat diesen Code geschrieben?! … Oh. Ich. Frag den Danny.',
      'Mein Code ist so schlecht, dass der Compiler geweint hat.',
      'Hab ein bisschen refactored. Jetzt ist es ein Lebewesen.',
      'Ich hab Kommentare reingeschrieben. Alle sagen „Sorry“.',
      'Läuft auf meinem Rechner! Also lief. Bevor er gebrannt hat.',
      'Ich hab Copy & Paste von Stack Overflow gemacht. Mit Werbung.'
    ],
    solved: [
      'Spaghetti zerlegt! Ich koch heute Abend Code bolognese.',
      'Hard Reset. Wie bei meiner letzten Beziehung.',
      'Code ist tot. Lang lebe der Code. Der nächste wird auch scheiße.'
    ]
  },
  sap: {
    label: 'Irgendwas mit SAP',
    tool: 'hammer',
    icon: '🗿',
    points: 600,
    limit: 0,
    feed: [
      'IRGENDWAS MIT SAP! Keiner kennt sich aus. Frag den Danny.',
      'SAP-Monolith durch die Decke gekracht. Transportauftrag hängt.',
      'Z-Report aus dem Jahr 1998 ist erwacht. Er will Customizing.'
    ],
    say: [
      'Irgendwas mit SAP. Ich kenn mich da nicht aus. Frag den Danny.',
      'Das ist ein SAP-Thema. Also kein Thema für Menschen.',
      'Wer hat den Transport freigegeben? Der wohnt jetzt im Wald.',
      'Laut SAP ist das kein Fehler, sondern ein Lizenzmodell.',
      'Ich hab nur F8 gedrückt. Jetzt brennt das Gebäude.',
      'Das ist Standard! Also Standard im Sinne von: kaputt.'
    ],
    solved: [
      'SAP zerschlagen! Die Lizenzgebühren laufen trotzdem weiter.',
      'Monolith in Microservices zerlegt. Mit dem Hammer. So geht Architektur.',
      'Danny hat SAP repariert. Also kaputt gemacht. Im Ergebnis gleich.'
    ]
  },
  brand: {
    label: 'Brand',
    tool: 'foam',
    icon: '🔥',
    points: 120,
    limit: 0,
    feed: [
      'Kabelbrand unterm Schreibtisch. Ursache: Mehrfachsteckdose an Mehrfachsteckdose an Mehrfachsteckdose.',
      'Der Projektplan brennt. Endlich ist er mal heiß.',
      'Toaster vom Vertrieb in Flammen. War schon immer der beste Mitarbeiter.',
      'Burn-out wörtlich genommen.'
    ],
    say: [],
    solved: []
  }
};

/** Kommentare, wenn ein Problem zu lange liegen bleibt und zum Brand wird */
export const ESCALATED = [
  'Zu spät. Jetzt brennt es. Also wie immer.',
  'Problem ignoriert. Hat zurückgebrannt.',
  'Eskaliert! Der Projektleiter hat schon die Grabrede angefangen.',
  'Brennt. Hätte man mal den Danny gefragt.',
  'Aus „mach ich gleich“ wurde Vollbrand.'
];

/** Wenn Danny Leute duscht (Abreibung) */
export const SHOWER = {
  berater: [
    'Ey! Mein Anzug kostet mehr als dein Auto!',
    'Danke, Danny. Jetzt bin ich endlich mal produktiv: nass.',
    'Das ist Mobbing! Aber erfrischendes Mobbing.',
    'Ich bin Berater! Ich werd sonst nur vom Kunden angepisst!',
    'Mein Gel! Mein schönes Gel!',
    'Ich wollte eh mal wieder duschen. Seit März.'
  ],
  dev: [
    'Meine Tastatur! Da sind noch Chips von 2019 drin!',
    'Ich bin allergisch gegen Wasser! Deshalb dusch ich auch nie.',
    'Das ist kein Bug, das ist ein Wasserschaden!',
    'Danke. Jetzt riecht der Hoodie wieder nach Hoodie.',
    'Hey! Ich hab gerade compiliert!'
  ],
  pl: [
    'Das kommt in mein Statusreport! In Rot!',
    'Danny, wir müssen über deine Kommunikation reden!',
    'Ich eskaliere das! Sobald ich trocken bin!',
    'Super, jetzt ist mein Gantt-Chart verlaufen!'
  ],
  kunde: [
    'Ist das im Wartungsvertrag drin?!',
    'Das stellen wir Ihnen in Rechnung! Also Sie uns. Egal!',
    'Change Request! CHANGE REQUEST!',
    'In meinem alten CRM bin ich nie nass geworden!'
  ]
};

export const ZAPPED = [
  'BZZZT! Ich seh meine Knochen! Und sie sehen müde aus!',
  'Meine Plomben spielen jetzt Radio!',
  'Danke Danny, mein Herz schlägt wieder. Leider auch für die Arbeit.',
  'Ich riech nach Grillparty!',
  'Mein Toupet! Wo ist mein Toupet?!'
];

export const BONKED = [
  'Aua! Das war mein Lieblingskopf!',
  'Ich hab Sterne gesehen! Und ein Budget!',
  'Danke, jetzt hab ich endlich Kopfschmerzen wegen was Sinnvollem.',
  'Hard Reset durchgeführt. Wer bin ich?'
];

export const DUCKED = [
  'Quak? Warum wirft der Danny mit Enten?',
  'Ich hab keine Frage! Aber jetzt hab ich eine Ente.',
  'Die Ente guckt mich so an. Ich fühl mich verurteilt.'
];

/** Danny's Sprüche, wenn er loslegt */
export const DANNY_LINES = [
  'Keine Panik, der Danny ist da.',
  'Wasser marsch!',
  'Wer löscht, der bleibt.',
  'Ich hab den längsten Schlauch im ganzen Büro. Fragt die Facility-Abteilung.',
  'Wo Rauch ist, ist auch ein Berater.',
  'Erst löschen, dann Lessons Learned. Dann wieder löschen.',
  'Ich komm, ich spritz, ich geh. Wie jeden Freitag.',
  'Für jeden Brand eine Lösung. Für jeden Berater ein Defi.',
  'Ich hab schon Projekte gelöscht, da wart ihr noch Excel-Tabellen.'
];

/** Werkzeugkoffer-Pakete, die zwischendurch auftauchen */
export const PICKUPS = {
  schlauch: { icon: '🚒', label: 'Großschlauch', desc: '8 s unendlicher Druck, doppelte Reichweite. Größe zählt eben doch.', time: 8 },
  kaffee: { icon: '☕', label: 'Doppelter Espresso', desc: '8 s schneller laufen. Herzrasen inklusive.', time: 8 },
  enten: { icon: '🦆', label: 'Enten-Nachschub', desc: '+6 Debug-Enten.', time: 0 },
  sprinkler: { icon: '💦', label: 'Sprinkleranlage', desc: 'Löscht das ganze Büro. Und alle Laptops gleich mit.', time: 0 }
};

export const PICKUP_LINES = {
  schlauch: 'Großschlauch! Jetzt wird es feucht.',
  kaffee: 'Espresso! Danny läuft jetzt auf 380 Volt.',
  enten: 'Neue Enten im Koffer. Quak quak, ihr Pfeifen.',
  sprinkler: 'SPRINKLER! Alle Laptops sind jetzt U-Boote.'
};

export const STAGE_LINES = [
  'Alarmstufe 1: Normaler Projektalltag. Also leichtes Feuer.',
  'Alarmstufe 2: Der Kunde hat das Lastenheft gelesen.',
  'Alarmstufe 3: Go-live wurde vorgezogen. Auf gestern.',
  'Alarmstufe 4: Der Vertrieb hat was versprochen.',
  'Alarmstufe 5: Freitagnachmittag-Deployment. Gott steh uns bei.'
];

export const RANKS = [
  { id: 'gott', min: 20000, name: 'Danny, der Feuergott', line: 'Die Kollegen wollen dir einen Schrein bauen. Aus feuerfestem Material.' },
  { id: 'ober', min: 10000, name: 'Oberbrandmeister', line: 'Das Büro steht noch. Die Berater leider auch.' },
  { id: 'melder', min: 4000, name: 'Brandmeldeanlage auf zwei Beinen', line: 'Viel Lärm, ordentlich nass, ein paar Tote im Backlog. Solide.' },
  { id: 'praktikant', min: 0, name: 'Praktikant mit Wasserpistole', line: 'Das Projekt ist abgebrannt. Aber du hast schön gespritzt.' }
];
export const rankFor = (score) => RANKS.find((r) => score >= r.min) || RANKS[RANKS.length - 1];

export const GAMEOVER_LINES = [
  'Projekt abgebrannt. Die Versicherung zahlt nicht, das war kein Unfall, das war Scrum.',
  'Das Büro ist Asche. Der Kunde fragt, ob das CRM trotzdem am Montag live geht.',
  'Alles weg. Gut, dass die Doku eh nie existiert hat.',
  'Brandursache laut Gutachten: „Hat keiner den Danny gefragt.“'
];

export const WIN_LINES = [
  'Feierabend! Danny hat den Laden gerettet. Morgen brennt er wieder.',
  'Schicht vorbei. Alle leben. Fast alle. Der Drucker nicht.',
  'Schichtende. Die Berater sind nass, das Projekt läuft. Mehr kann man nicht verlangen.'
];
