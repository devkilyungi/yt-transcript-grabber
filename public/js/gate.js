// Runs before first paint, as a blocking classic script, so the saved theme never flashes and the splash cover is up before anything shows.
(() => {
  const root = document.documentElement;
  try {
    const saved = JSON.parse(localStorage.getItem('house') || '{}');
    // shortcut: the old app kept its theme in `tg.theme`; read it until nobody has an old install left.
    const theme = saved.theme || localStorage.getItem('tg.theme');
    if (theme === 'light' || theme === 'dark') root.dataset.theme = theme;
  } catch { /* private mode or blocked storage: the defaults stand */ }
  if (window.desktop) root.dataset.desktop = '';
  if (!root.hasAttribute('data-splash') || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const nav = performance.getEntriesByType('navigation')[0];
  if ((nav && nav.type !== 'navigate') || document.visibilityState !== 'visible') return;
  try {
    if (sessionStorage.getItem('house-intro')) return;
    sessionStorage.setItem('house-intro', '1');
  } catch { /* blocked storage: play it, as on any fresh visit */ }
  root.dataset.intro = 'play';
})();
