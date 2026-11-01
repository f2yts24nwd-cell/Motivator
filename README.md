# Motivator – itmX Spielewelt

Interaktive 3D-Action-Spielewelt (PWA) für Sales-Helden. Man läuft durch ein stilisiertes
Sales-Büro, und jedes Spiel ist ein Arcade-Automat.

## Spiel 1: „Hau den Legacy!“

- Aus 9 Löchern tauchen Köpfe auf: SAP, Cloud-CRM, Excel, Access, Internet Explorer, Diskette, Karl Klammer.
  Alle sind eigene, stilisierte 3D-Nachbauten mit Glubschaugen, keine Original-Logodateien.
- Draufhauen gibt Punkte. Getroffene Köpfe zerspringen mit Splittern, Farb-Splatter, Funken,
  Schockwelle, Kamera-Shake und Hit-Stop.
- **itmX verschonen!** Ein Treffer kostet 250 Punkte und einen Fehler. Nach 3 Fehlern ist Game over.
- 60 Sekunden, Ziel 2.000 Punkte. Combo-Multiplikator bis x5, das Tempo steigt mit der Zeit.
- Wer gewinnt, bekommt vom Zottel das **Schwetz-Zertifikat für CRM-Expertise**: mit Namen, als PNG
  zum Speichern oder Teilen.

Steuerung: Maus oder Touch. Auf der Tastatur entsprechen die Ziffern 1–9 dem 3×3-Raster (Nummernblock-Layout).
In der Spielewelt: Klick oder Tippen zum Laufen, alternativ WASD bzw. Pfeiltasten.

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
  cert/                Zottel-Figur, Übergabe-Szene, Zertifikat-Rendering
public/brand/          itmX-Logo (Platzhalter, siehe README dort)
```

### Neues Spiel hinzufügen

1. Klasse mit `scene`, `camera`, `enter()`, `exit()`, `update(dt, time)` und `resize(w, h)` anlegen.
2. In `src/games/registry.js` eintragen (`available: true`). Der Automat erscheint dann automatisch im Büro.

## Deployment (GitHub Pages)

Der Workflow `.github/workflows/deploy.yml` baut und veröffentlicht bei jedem Push auf `main`.
Einmalig unter *Settings → Pages → Source* „GitHub Actions“ auswählen.
Der Build nutzt relative Pfade und läuft daher auch auf jedem anderen statischen Hosting.
