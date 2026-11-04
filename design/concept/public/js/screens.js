// Concept screens: one document, one screen per ?s=. Wires the kit's shell, then the few behaviours that show how the product moves.
import { initTheme } from './theme.js';
import { initNav } from './nav.js';
import { play } from './splash.js';
import { toast } from './toasts.js';

const q = new URLSearchParams(location.search);
const want = q.get('s') || 'home';
const screen = want === 'note' ? 'reading' : want;
document.querySelectorAll('.screen').forEach(s => { if (s.dataset.screen !== screen) s.remove(); });
if (screen !== 'reading') document.querySelectorAll('.mini, .now-pill').forEach(el => el.remove());
if (want === 'note') {
  document.querySelector('.pop')?.remove();
  document.querySelector('.note-card').hidden = false;
  document.querySelector('mark.hl')?.setAttribute('data-note', '');
}

// Per-element values through the CSSOM, never inline style attributes (the CSP forbids them).
document.querySelectorAll('[data-css]').forEach(el => { el.style.cssText = el.dataset.css; });

// Links keep the skin they were opened with, so the page transition stays inside one material.
const keep = ['m', 't'].filter(k => q.has(k)).map(k => `&${k}=${q.get(k)}`).join('');
document.querySelectorAll('a[href^="screens.html"]').forEach(a => { a.href += keep; });
document.querySelectorAll('.links a[data-for]').forEach(a => { if (a.dataset.for.split(' ').includes(screen)) a.setAttribute('aria-current', 'page'); });

initTheme([document.getElementById('theme')]);
initNav();
play();

const show = (btn, i) => [...btn.querySelector('.states').children].forEach((s, k) => s.classList.toggle('on', k === i));

// Get transcript: busy in place, then on to the result (a cross-document view transition).
document.querySelectorAll('.grab-form').forEach(form => form.addEventListener('submit', e => {
  e.preventDefault();
  const btn = form.querySelector('.go');
  if (btn.getAttribute('aria-busy') === 'true') return;
  btn.setAttribute('aria-busy', 'true');
  show(btn, 1);
  setTimeout(() => { location.href = `screens.html?s=result${keep}`; }, 900);
}));
document.querySelector('.sample')?.addEventListener('click', () => { location.href = `screens.html?s=loading${keep}`; });

// Loading: the skeleton only appears if the wait passes 300ms, so a fast answer never flashes it.
setTimeout(() => document.querySelectorAll('.skeleton.late').forEach(s => { s.hidden = false; }), 300);

// Copy for summary: the label swaps to Copied for 1.6s; the toast says the same words to #live.
document.querySelectorAll('.copy').forEach(btn => btn.addEventListener('click', () => {
  show(btn, 1);
  toast({ title: 'Transcript copied', body: 'Paste it into Claude and ask for a summary.' });
  setTimeout(() => show(btn, 0), 1600);
}));
document.querySelectorAll('.dl').forEach(btn => btn.addEventListener('click', () => toast({ title: 'Downloaded', body: 'how-bridges-hold-up.txt is in your downloads.' })));

// Follow-along: every 4s the next paragraph becomes "now", as the video would drive it.
const paras = [...document.querySelectorAll('.para')];
if (screen === 'reading' || screen === 'result') {
  setInterval(() => {
    const i = paras.findIndex(p => p.classList.contains('now'));
    paras[i]?.classList.remove('now');
    paras[i]?.removeAttribute('aria-current');
    const next = paras[(i + 1) % paras.length];
    next.classList.add('now');
    next.setAttribute('aria-current', 'true');
  }, 4000);
}
document.querySelector('.now-pill')?.addEventListener('click', () => document.querySelector('.para.now')?.scrollIntoView({ block: 'center' }));

// Highlight: the wash swipes on only for the highlight just made; reopened ones are already there.
document.querySelector('.pop .btn')?.addEventListener('click', () => {
  const m = document.querySelector('mark.hl');
  m.classList.remove('fresh');
  void m.offsetWidth; // restart the animation
  m.classList.add('fresh');
  toast({ tone: 'accent', title: 'Highlighted', body: 'Find it again under Highlights.', action: { label: 'Undo', run: () => m.classList.remove('fresh') } });
});

// Rate-limit countdown: whole seconds, then the notice would fold away and the queue resume.
document.querySelectorAll('.countdown').forEach(el => {
  let n = Number(el.dataset.from);
  const tick = setInterval(() => { n = n > 1 ? n - 1 : Number(el.dataset.from); el.textContent = n; }, 1000);
  addEventListener('pagehide', () => clearInterval(tick));
});
