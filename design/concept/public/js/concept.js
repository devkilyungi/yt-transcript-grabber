// The concept document: the kit's shell, per-element values through the CSSOM, and replay buttons for the frames' splashes.
import { initTheme } from './theme.js';
import { initNav } from './nav.js';
import { play } from './splash.js';

document.querySelectorAll('[data-css]').forEach(el => { el.style.cssText = el.dataset.css; });
initTheme([document.getElementById('theme')]);
initNav();
play();

document.querySelectorAll('.replay').forEach(btn => btn.addEventListener('click', () => {
  const host = document.getElementById(btn.dataset.for);
  const frame = host.matches('iframe') ? host : host.querySelector('iframe');
  const url = new URL(frame.src);
  url.searchParams.set('splash', '1');
  frame.src = url.href;
}));
