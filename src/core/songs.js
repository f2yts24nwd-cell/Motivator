// The jukebox playlist. To add a song:
//   1. put the file into public/music/ (mp3, ideally 96–128 kbps; cover as small webp/png, ~160×160)
//   2. add an entry below. The jukebox in the office lists it automatically, newest entries first
//      can be marked with `neu: true`.
const BASE = import.meta.env.BASE_URL;
const file = (name) => `${BASE}music/${name}`;

export const SONGS = [
  {
    id: 'system-overload',
    title: 'CRM – System Overload',
    artist: 'itmX Spielewelt · mit Suno erstellt',
    src: file('system-overload.mp3'),
    cover: file('system-overload-cover.webp'),
    duration: 368,
    note: 'Der Song zu Spiel 4 „Das CRM-Königreich“',
    neu: true
  }
];

export const songById = (id) => SONGS.find((s) => s.id === id);
