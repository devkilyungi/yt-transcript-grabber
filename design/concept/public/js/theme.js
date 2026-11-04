// Theme switch: dark spreads out of the toggle as a circle, light pulls back into it. `D` toggles from anywhere but a text field.
import { save } from './store.js';

const root = document.documentElement;
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const systemDark = matchMedia('(prefers-color-scheme: dark)');
export const isDark = () => (root.dataset.theme ? root.dataset.theme === 'dark' : systemDark.matches);

// The browser chrome follows the page: theme-color is read back from the body's resolved background.
export function syncChrome() {
  const bg = getComputedStyle(document.body).backgroundColor;
  document.querySelectorAll('meta[name="theme-color"]').forEach(m => m.setAttribute('content', bg));
}

export function toggle(from) {
  const next = isDark() ? 'light' : 'dark';
  const apply = () => { root.dataset.theme = next; save({ theme: next }); syncChrome(); };
  if (!document.startViewTransition || reduced.matches || !from) return apply();
  const r = from.getBoundingClientRect();
  const x = r.left + r.width / 2, y = r.top + r.height / 2;
  const end = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
  const spread = next === 'dark';
  root.dataset.themeTransition = spread ? 'spread' : 'retract';
  const t = document.startViewTransition(apply);
  t.ready.then(() => {
    const clip = [`circle(0px at ${x}px ${y}px)`, `circle(${end}px at ${x}px ${y}px)`];
    // As in Tally, Keyway, Tessera and Edgeline: dark bursts out and settles, light gathers speed as it pulls back in.
    root.animate({ clipPath: spread ? clip : clip.reverse() }, {
      duration: 550, easing: spread ? 'cubic-bezier(0.4, 0, 0.2, 1)' : 'cubic-bezier(0.6, 0, 0.8, 0.4)',
      pseudoElement: spread ? '::view-transition-new(root)' : '::view-transition-old(root)',
    });
  }).catch(() => {}); // skipped (tab hidden): the theme still switched
  t.finished.finally(() => delete root.dataset.themeTransition);
}

export function initTheme(buttons) {
  buttons.forEach(b => b.addEventListener('click', () => toggle(b)));
  addEventListener('keydown', e => {
    if (e.key.toLowerCase() !== 'd' || e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
    if (e.target.closest('input, textarea, select, [contenteditable]')) return;
    const visible = buttons.find(b => b.offsetParent) || buttons[0];
    toggle(visible);
  });
  systemDark.addEventListener('change', syncChrome);
  syncChrome();
}
