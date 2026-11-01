# Motivator – itmX Spielewelt

Interaktive 3D-Action-Spielewelt (PWA) für Sales-Helden. Man läuft durch ein stilisiertes
Sales-Büro, und jedes Spiel ist ein Arcade-Automat.

## Spiel 1: „Hau den Legacy!“

- Aus 9 Löchern tauchen Köpfe auf: SAP, Cloud-CRM, Excel, Access, Internet Explorer, Diskette, Karl Klammer.
  Alle sind eigene, stilisierte 3D-Nachbauten mit Glubschaugen, keine Original-Logodateien.
- Draufhauen gibt Punkte. Getroffene Köpfe zerspringen mit Splittern, Farb-Splatter, Funken,
  Schockwelle, Kamera-Shake und Hit-Stop.
- **itmX verschonen!** Der itmX-Kopf ist das echte Logo als 3D-Objekt (grüne Kachel, weißes X, Heiligenschein). Ein Treffer kostet 250 Punkte und einen Fehler. Nach 3 Fehlern ist Game over.
- 90 Sekunden. Combo-Multiplikator bis x5, das Tempo steigt mit der Zeit.
- Jede Runde endet mit dem **Schwetz-Zertifikat für CRM-Expertise**, überreicht von **Dumêz G. Schwetz**. Die Stufe richtet sich nach den Punkten: Gold ab 6.000, Silber ab 3.500, Bronze ab 1.500, sonst Teilnahme. Das Zertifikat trägt deinen Namen und lässt sich als PNG speichern oder teilen. Dein Avatar steht bei der Übergabe mit auf der Bühne.

Steuerung: Maus oder Touch. Auf der Tastatur entsprechen die Ziffern 1–9 dem 3×3-Raster (Nummernblock-Layout).
In der Spielewelt: Klick oder Tippen zum Laufen, alternativ WASD bzw. Pfeiltasten.

## Spiel 2: „Rettet den Feierabend!“

Ein Arbeitstag im Leben von Tim X. (nach „A Day in the Life of a Salesman“ auf itmx.de), in 90 Sekunden von 09:00 bis 17:30.

- Aufgaben rasen als Glas-Hologrammkarten über eine Neon-Datenautobahn auf die Deadline zu: Anrufe, Mails, Kundenfragen, Angebote, Reklamationen.
- Unten liegt der Werkzeuggürtel mit 9 itmX-Funktionen: Outlook + CRM, Teams-Anruf, Globale Suche, Customer 360, Pipeline, Bericht per Sprache, Angebot in SAP, Ticket und „Ab in die Tonne“ für Legacy-Kram.
  Das richtige Werkzeug zerlegt die Karte (Splitter, Schockwelle, Hit-Stop) und spart Minuten. Über dem Gürtel steht die aktuelle Aufgabe groß lesbar.
- Was die Deadline erreicht, fliegt auf den Papierstapel. Bei 5 Stapeln kommt die Papierlawine und der Tag ist vorbei.
- **Low Hanging Fruits:** Goldene Früchte hängen tief über der Strecke. Direkt antippen gibt Bonus-Minuten.
- **Die Extra Meile:** Eine lange Combo startet die Extra Meile mit doppelten Minuten, goldener Strecke und dem Drop im Soundtrack.
- **„Das eine nicht tun, dafür das andere lassen!“** Um 11:00 kommt Dumêz G. Schwetz vorbei. Danach mischen sich seine Aufträge darunter (Meetings über Meetings, Reports, die keiner liest). Richtig ist: lassen.
- Am Ende gibt es Lernkarten zu jeder Funktion mit Link zum passenden itmX-Video und das Schwetz-Zertifikat.
- Soundtrack: Melodic Techno mit 124 BPM, ebenfalls komplett per WebAudio erzeugt (Kick, rollender Bass mit Sidechain, Hi-Hats, Arpeggio mit Delay, Pads, Supersaw-Lead). Die Intensität folgt dem Tag.

Steuerung: Werkzeuge antippen oder Tasten 1–9. Eine Karte antippen wählt sie gezielt aus, sonst trifft das Werkzeug die dringendste Aufgabe.

## Avatar & Kleiderschrank

Über den 👔-Knopf im Büro gestaltest du deinen Avatar: Oberteil, Hose oder Rock, Schuhe, Accessoire, Farben,
Frisur, Hautton und Name (der Name landet auf dem Zertifikat). Erlaubt ist nur Business-Look. Wer Hoodie,
Feinripp, Hawaiihemd, kurze Hose, Jogginghose, Sandalen, Socken in Sandalen, Badelatschen, Goldkette, Basecap
oder Bauchtasche wählt, bekommt von oben einen Nackenklatscher samt Hinweis, und das Teil ist wieder weg.

## Sound

Der orchestrale Soundtrack wird komplett im Browser erzeugt (WebAudio, keine Audiodateien): Taiko-Drums,
Streicher-Ostinato, Blechbläser, Chor, Hall, Riser und „Braaam“-Impacts. Im Spiel steigert sich die
Intensität über die 90 Sekunden. Büro und Zertifikatsübergabe haben jeweils ein eigenes Thema.

## Auf dem iPhone spielen (z. B. iPhone 17)

1. Die veröffentlichte Seite in **Safari** öffnen.
2. Teilen-Symbol → **„Zum Home-Bildschirm“**. Die Spielewelt startet dann im Vollbild wie eine App und läuft auch offline.
3. Hoch- und Querformat werden unterstützt. Im Hochformat wechselt das Spielbrett auf ein höheres Layout mit größeren Löchern.
4. Ton: Er startet nach dem ersten Antippen. Ist der Stummschalter am iPhone aktiv, bleibt das Spiel stumm.

Für iOS umgesetzt: Safe Areas (Dynamic Island, Home-Indikator), kein Pinch- oder Doppeltipp-Zoom und
kein „Gummiband“-Scrollen, Audio-Freischaltung per Tipp, vorkompilierte Shader (kein Ruckeln beim ersten
Treffer), adaptive Renderauflösung, Pause im Hintergrund. Das Zertifikat wird über das Teilen-Menü gespeichert („Bild sichern“).

## Entwicklung

```bash
npm install
npm run dev       # lokaler Dev-Server
npm run build     # Produktions-Build nach dist/ (inkl. Service Worker + Manifest)
npm run preview   # Build lokal testen
npm run icons     # PWA-Icons neu rendern (nutzt Playwright/Chromium)
```

Tech: three.js (WebGL, PBR-Materialien, Schatten, Bloom-Postprocessing), Vite und vite-plugin-pwa.
Alle Sounds werden per WebAudio synthetisiert, dadurch läuft das Spiel komplett offline.

## Projektstruktur

```
src/
  main.js              App-Start, Szenenwechsel, Render-Loop
  core/                Renderer/Postprocessing, Audio, UI-Helfer
  hub/hub.js           Begehbares 3D-Büro mit Arcade-Automaten
  games/registry.js    Liste aller Spiele (hier neue Spiele eintragen)
  games/whack/         „Hau den Legacy!“ (Köpfe, Effekte, Spiellogik)
  cert/                Dumêz G. Schwetz, Übergabe-Szene, Zertifikat-Rendering
  hub/avatar.js        Avatar und Kleiderschrank (Business-Look-Pflicht)
public/brand/          offizielles itmX-Logo (PNG)
```

### Neues Spiel hinzufügen

1. Klasse mit `scene`, `camera`, `enter()`, `exit()`, `update(dt, time)` und `resize(w, h)` anlegen.
2. In `src/games/registry.js` eintragen (`available: true`). Der Automat erscheint dann automatisch im Büro.

## Deployment (GitHub Pages)

Der Workflow `.github/workflows/deploy.yml` baut und veröffentlicht bei jedem Push auf `main`.
Einmalig unter *Settings → Pages → Source* „GitHub Actions“ auswählen.
Der Build nutzt relative Pfade und läuft daher auch auf jedem anderen statischen Hosting.
