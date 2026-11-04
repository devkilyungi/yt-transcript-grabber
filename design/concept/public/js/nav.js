// The bar: a burger menu on phones (Esc or a link closes it and gives focus back), and a scroll spy that marks the section in view.
export function initNav() {
  const menu = document.getElementById('menu');
  const burger = document.getElementById('burger');
  const narrow = matchMedia('(max-width: 820px)');

  const setOpen = (open, refocus) => {
    burger.setAttribute('aria-expanded', open);
    menu.toggleAttribute('data-open', open);
    if (!open && refocus) burger.focus();
  };
  burger.addEventListener('click', () => setOpen(burger.getAttribute('aria-expanded') !== 'true'));
  menu.addEventListener('click', e => { if (e.target.closest('a')) setOpen(false); });
  addEventListener('keydown', e => { if (e.key === 'Escape' && menu.hasAttribute('data-open')) setOpen(false, true); });
  document.addEventListener('pointerdown', e => { if (menu.hasAttribute('data-open') && !e.target.closest('.bar')) setOpen(false); });
  narrow.addEventListener('change', () => setOpen(false));

  // Scroll spy: the last section whose top has passed a line a third of the way down the screen.
  const links = [...menu.querySelectorAll('a[href^="#"]')];
  const sections = links.map(a => document.querySelector(a.getAttribute('href'))).filter(Boolean);
  let raf = 0;
  const spy = () => {
    raf = 0;
    const line = innerHeight / 3;
    let current = null;
    for (const s of sections) if (s.getBoundingClientRect().top <= line) current = s;
    links.forEach(a => (a.getAttribute('href') === `#${current?.id}` ? a.setAttribute('aria-current', 'true') : a.removeAttribute('aria-current')));
  };
  addEventListener('scroll', () => { raf ||= requestAnimationFrame(spy); }, { passive: true });
  spy();
}
