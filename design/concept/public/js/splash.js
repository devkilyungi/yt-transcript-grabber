// The splash: the mark draws itself, glides onto the bar's logo, then the cover leaves the material's own way.
// Kit timeline unchanged; the glaze canvas is gone and the exits are this project's: swipe (marker), feed (ditto), flip (steno). All three are CSS.
const GLIDE_AT = 760; // the mark starts flying to the bar (CSS glides it over 440ms)
const OPEN_AT = 1000; // the cover starts to leave
const OPEN = 620;     // the exits take 560ms, plus a frame of slack
const EXIT = { marker: 'swipe', ditto: 'feed', steno: 'flip' };

const root = document.documentElement;
const splash = document.getElementById('splash');
let mark = null; // one mark per material; the visible one is picked when the splash plays
let timers = [], stop = null;

function glide() {
  const to = [...document.querySelectorAll('.bar .brand-mark')].find(m => m.getClientRects().length)?.getBoundingClientRect();
  if (!to || !mark) return;
  const from = mark.getBoundingClientRect();
  mark.style.translate = `${to.left + to.width / 2 - (from.left + from.width / 2)}px ${to.top + to.height / 2 - (from.top + from.height / 2)}px`;
  mark.style.scale = `${to.width / from.width}`;
}

function open() {
  root.dataset.intro = 'reveal';
  timers.push(setTimeout(finish, OPEN));
}

export function finish() {
  timers.forEach(clearTimeout);
  timers = [];
  stop?.abort();
  delete root.dataset.intro;
  if (mark) mark.style.translate = mark.style.scale = '';
}

/** Plays the splash if gate.js has raised the cover. */
export function play() {
  if (root.dataset.intro !== 'play') return;
  splash.dataset.exit = EXIT[root.dataset.material] || EXIT.marker;
  mark = [...splash.querySelectorAll('.splash-mark')].find(m => m.getClientRects().length);
  stop = new AbortController();
  const opts = { once: true, passive: true, capture: true, signal: stop.signal };
  ['pointerdown', 'keydown', 'wheel', 'touchmove'].forEach(type => addEventListener(type, finish, opts));
  document.addEventListener('visibilitychange', finish, opts);
  timers = [setTimeout(glide, GLIDE_AT), setTimeout(open, OPEN_AT)];
}
