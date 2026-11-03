import { WhackGame } from './whack/whack.js';
import { FeierabendGame } from './feierabend/feierabend.js';
import { ConversionGame } from './conversion/conversion.js';
import { KoenigreichGame } from './crm/crm.js';

// Every game in the world gets its own arcade cabinet in the office hub.
// To add a new game: create a class with enter()/exit()/update(dt,time)/resize(w,h)
// plus `scene` and `camera`, and register it here.
export const GAMES = [
  {
    id: 'whack',
    title: 'Hau den Legacy!',
    tagline: 'Hau SAP, Excel & Co. weg, aber verschone itmX!',
    color: '#19c3ff',
    available: true,
    create: (app) => new WhackGame(app)
  },
  {
    id: 'feierabend',
    title: 'Rettet den Feierabend!',
    tagline: 'Ein Tag im Leben von Tim X.: das richtige itmX-Werkzeug für jede Aufgabe, bevor sie auf dem Papierstapel landet.',
    color: '#ff3d9a',
    available: true,
    create: (app) => new FeierabendGame(app)
  },
  {
    id: 'conversion',
    title: 'Mission RC 0',
    tagline: 'Die S/4HANA-Conversion: Transporte in der richtigen Reihenfolge importieren, den SAP Business Partner besiegen und das neue CRM der Ludlein Crew live bringen.',
    color: '#ffb000',
    available: true,
    create: (app) => new ConversionGame(app)
  },
  {
    id: 'koenigreich',
    title: 'Das CRM-Königreich',
    tagline: 'Erz abbauen, mit den Modul-Händlern handeln und auf dem SAP-Fundament die vier Türme Marketing, Sales, Service und Commerce bauen. Nachts kommen die Legacy-Monster.',
    color: '#3ddc84',
    available: true,
    create: (app) => new KoenigreichGame(app)
  },
  { id: 'soon-5', title: 'Bald verfügbar', tagline: 'Hier entsteht das nächste Spiel.', color: '#a46bff', available: false }
];
