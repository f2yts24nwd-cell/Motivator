import { WhackGame } from './whack/whack.js';

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
  { id: 'soon-1', title: 'Bald verfügbar', tagline: 'Hier entsteht das nächste Spiel.', color: '#ff3d9a', available: false },
  { id: 'soon-2', title: 'Bald verfügbar', tagline: 'Hier entsteht das nächste Spiel.', color: '#ffcc4d', available: false },
  { id: 'soon-3', title: 'Bald verfügbar', tagline: 'Hier entsteht das nächste Spiel.', color: '#3ddc84', available: false }
];
