// Runs before first paint, as a blocking classic script, so the saved theme and material never flash and the splash cover is up before anything shows.
// Kit behaviour, plus two concept-only overrides so the comparison frames can be driven by their URL: ?m=<material>&t=<light|dark> picks the skin,
// and ?splash=1 plays the splash on demand (still never under reduced motion). The build drops both overrides.
(() => {
  const root = document.documentElement;
  const q = new URLSearchParams(location.search);
  const MATERIALS = ['marker', 'ditto', 'steno'];
  try {
    const saved = JSON.parse(localStorage.getItem('house') || '{}');
    if (saved.theme === 'light' || saved.theme === 'dark') root.dataset.theme = saved.theme;
  } catch { /* private mode or blocked storage: the defaults stand */ }
  if (q.get('t') === 'light' || q.get('t') === 'dark') root.dataset.theme = q.get('t');
  if (MATERIALS.includes(q.get('m'))) root.dataset.material = q.get('m');
  if (!root.hasAttribute('data-splash') || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (q.get('splash') === '1') { root.dataset.intro = 'play'; return; }
  if (self !== top) return; // concept frames stay quiet unless asked
  const nav = performance.getEntriesByType('navigation')[0];
  if ((nav && nav.type !== 'navigate') || document.visibilityState !== 'visible') return;
  try {
    if (sessionStorage.getItem('house-intro')) return;
    sessionStorage.setItem('house-intro', '1');
  } catch { /* blocked storage: play it, as on any fresh visit */ }
  root.dataset.intro = 'play';
})();
