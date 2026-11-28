import { h } from '../../core/ui.js';
import { music, sfx, primeSong } from '../../core/audio.js';
import { storeGet, storeSet } from '../../core/ui.js';
import { SONGS } from '../../core/songs.js';

// Car radio "Ocean FM": every song of the office jukebox. Plays while you sit in a car,
// fades out when you get out (the synthesized soundtrack takes over again).
export class CarRadio {
  constructor(game, root) {
    this.game = game;
    this.state = { on: true, id: (SONGS.find((s) => s.id === 'crm-cruise') || SONGS[0])?.id, ...storeGet('xcity-radio', {}) };
    this.active = false;
    this.img = h('img', { alt: '' });
    this.title = h('b');
    this.chip = h('button.xc-radio', { title: 'Autoradio (P an/aus, N nächster Song)', onclick: (e) => { e.stopPropagation(); sfx.click(); this.togglePanel(); } }, [
      this.img, h('span', {}, [h('small', {}, '📻 Ocean FM'), this.title]), h('i.xc-eq', {}, [h('em'), h('em'), h('em')])
    ]);
    this.panel = h('div.xc-radio-panel');
    root.append(this.chip, this.panel);
    this.render();
  }
  get song() { return SONGS.find((s) => s.id === this.state.id) || SONGS[0]; }
  save() { storeSet('xcity-radio', this.state); }

  /** take over the song callbacks while a car radio plays */
  hooks(on) {
    if (on && !this.saved) {
      this.saved = { end: music.onSongEnd, err: music.onSongError };
      music.onSongEnd = (url) => { if (this.active && url === this.song.src) this.step(1); };
      music.onSongError = (url) => { if (url === this.song.src) this.game.hud?.say('funk', '📻 Kein Empfang – der Song konnte nicht geladen werden.', 3); };
    } else if (!on && this.saved) {
      music.onSongEnd = this.saved.end; music.onSongError = this.saved.err; this.saved = null;
    }
  }
  enterCar() {
    this.active = true;
    this.hooks(true);
    this.apply();
  }
  exitCar() {
    if (!this.active) return;
    this.active = false;
    this.panel.classList.remove('on');
    if (this.state.on) { music.stopSong(0.8); this.game.resumeTheme(); }
    this.hooks(false);
    this.render();
  }
  apply(restart = false) {
    if (!SONGS.length) return;
    if (this.active && this.state.on) music.playSong(this.song.src, { restart, loop: SONGS.length === 1 });
    else if (this.active) { music.stopSong(0.6); this.game.resumeTheme(); }
    this.render();
  }
  play(id) { this.state.id = id; this.state.on = true; this.save(); this.apply(true); this.game.hud?.say('tim', `📻 ${this.song.title}`, 2.2); }
  step(d) {
    const i = SONGS.indexOf(this.song);
    this.play(SONGS[(i + d + SONGS.length) % SONGS.length].id);
  }
  toggle() { this.state.on = !this.state.on; this.save(); this.apply(); }
  prime() { if (this.state.on && SONGS.length) primeSong(this.song.src); }
  togglePanel() { this.panel.classList.toggle('on'); this.render(); }

  render() {
    const s = this.song;
    this.chip.classList.toggle('show', this.active);
    this.chip.classList.toggle('off', !this.state.on);
    if (s) { this.img.src = s.cover; this.title.textContent = this.state.on ? s.title : 'Radio aus'; }
    if (!this.panel.classList.contains('on')) return;
    const ctl = (t, label, fn) => h('button.xc-rbtn', { title: t, onclick: (e) => { e.stopPropagation(); sfx.click(); fn(); } }, label);
    this.panel.replaceChildren(
      h('div.xc-rhead', {}, [h('b', {}, '📻 Ocean FM'), h('button.xc-rclose', { onclick: (e) => { e.stopPropagation(); this.togglePanel(); } }, '✕')]),
      h('div.xc-rctl', {}, [ctl('Vorheriger Song', '⏮', () => this.step(-1)), ctl(this.state.on ? 'Radio aus (P)' : 'Radio an (P)', this.state.on ? '⏸' : '▶', () => this.toggle()), ctl('Nächster Song (N)', '⏭', () => this.step(1))]),
      h('div.xc-rlist', {}, SONGS.map((x) => h(`button.xc-rsong${this.state.on && x.id === s.id ? '.on' : ''}`, { onclick: (e) => { e.stopPropagation(); sfx.click(); this.play(x.id); } }, [
        h('img', { src: x.cover, alt: '' }), h('span', {}, [h('b', {}, x.title), h('small', {}, x.note || x.artist)])
      ])))
    );
  }
  destroy() { this.hooks(false); this.chip.remove(); this.panel.remove(); }
}
