import { h } from '../../core/ui.js';
import { sfx, music } from '../../core/audio.js';
import { SONG } from './content.js';

/** "Now playing" chip for the song after the game; tapping it toggles play/pause. */
export function songChip() {
  const el = h('button.kr-song', { title: 'Song an/aus', onclick: () => {
    sfx.click();
    if (music.songPlaying) music.stopSong(0.6); else music.playSong(SONG.url);
    setTimeout(() => el.classList.toggle('off', !music.songPlaying), 50);
  } }, [
    h('img', { src: SONG.cover, alt: '' }),
    h('span', {}, [h('small', {}, '♪ Der Song zum Königreich'), h('b', {}, SONG.title)]),
    h('i.kr-eq', {}, [h('em'), h('em'), h('em')])
  ]);
  return el;
}
