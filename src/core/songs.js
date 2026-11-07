// The jukebox playlist. To add a song:
//   1. put the file into public/music/ (mp3, ideally 96–128 kbps; cover as small webp/png, ~160×160)
//   2. add an entry below. The jukebox in the office lists it automatically, newest entries first
//      can be marked with `neu: true`.
const BASE = import.meta.env.BASE_URL;
const file = (name) => `${BASE}music/${name}`;

export const SONGS = [
  {
    id: 'frag-den-danny',
    title: 'Frag den Danny',
    artist: 'itmX Spielewelt · mit Suno erstellt',
    src: file('frag-den-danny.mp3'),
    cover: file('frag-den-danny-cover.webp'),
    duration: 272,
    note: 'Deutschrap · Der Song zum Bonusspiel',
    neu: true
  },
  {
    id: 'crm-cruise',
    title: 'CRM Cruise',
    artist: 'itmX Spielewelt · mit Suno erstellt',
    src: file('crm-cruise.mp3'),
    cover: file('crm-cruise-cover.webp'),
    duration: 198,
    note: 'Chill Rap · Das Autoradio aus „Ludlein Drive“'
  },
  {
    id: 'mehr-verkaufen',
    title: 'Mehr verkaufen, weniger verwalten',
    artist: 'itmX Spielewelt · mit Suno erstellt',
    src: file('mehr-verkaufen.mp3'),
    cover: file('mehr-verkaufen-cover.webp'),
    duration: 280,
    note: 'Melodic Schranz · Ein Tag im Leben von Tim X.'
  },
  {
    id: 'system-overload',
    title: 'CRM – System Overload',
    artist: 'itmX Spielewelt · mit Suno erstellt',
    src: file('system-overload.mp3'),
    cover: file('system-overload-cover.webp'),
    duration: 368,
    note: 'Der Song zu Spiel 4 „Das CRM-Königreich“'
  }
];

export const songById = (id) => SONGS.find((s) => s.id === id);
