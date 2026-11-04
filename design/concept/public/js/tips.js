// One shared tip card for every dotted term. Hover opens it after a beat and closing waits a little longer, so the pointer can cross onto the card.
// Focus opens it too, a tap toggles it, and Esc closes it. The card is fixed, so no panel's overflow can clip it.
const OPEN_DELAY = 120;
const CLOSE_DELAY = 180;
const tip = document.getElementById('tip');
let current = null, openTimer = 0, closeTimer = 0;

function place(term) {
  const r = term.getBoundingClientRect();
  const w = tip.offsetWidth, h = tip.offsetHeight, pad = 12;
  const up = r.bottom + 10 + h > innerHeight - pad && r.top - 10 - h > pad;
  const left = Math.min(Math.max(pad, r.left + r.width / 2 - w / 2), innerWidth - w - pad);
  tip.classList.toggle('up', up);
  tip.style.left = `${left}px`;
  tip.style.top = `${up ? r.top - 10 - h : r.bottom + 10}px`;
  tip.style.setProperty('--arrow', `${Math.min(Math.max(14, r.left + r.width / 2 - left - 5), w - 24)}px`);
}

function open(term, tips) {
  clearTimeout(closeTimer);
  const entry = tips[term.dataset.tip];
  if (!entry) return;
  if (current && current !== term) current.setAttribute('aria-expanded', 'false');
  const [kind, title, body, linkText, href] = entry;
  const parts = [Object.assign(document.createElement('span'), { className: 'caps', textContent: kind }), Object.assign(document.createElement('strong'), { textContent: title }), Object.assign(document.createElement('p'), { textContent: body })];
  if (href) parts.push(Object.assign(document.createElement('a'), { href, textContent: linkText, target: '_blank', rel: 'noreferrer' }));
  tip.replaceChildren(...parts);
  current = term;
  term.setAttribute('aria-expanded', 'true');
  term.setAttribute('aria-describedby', 'tip');
  place(term);
  tip.classList.add('on');
}

function close() {
  clearTimeout(openTimer);
  if (!current) return;
  current.setAttribute('aria-expanded', 'false');
  current.removeAttribute('aria-describedby');
  current = null;
  tip.classList.remove('on');
}

/** tips: { key: [kind, title, body, linkText?, href?] }, matched by data-tip on a button.term */
export function initTips(tips) {
  const hover = matchMedia('(hover: hover)');
  document.querySelectorAll('.term[data-tip]').forEach(term => {
    term.setAttribute('aria-expanded', 'false');
    term.addEventListener('pointerenter', () => { if (!hover.matches) return; clearTimeout(closeTimer); openTimer = setTimeout(() => open(term, tips), OPEN_DELAY); });
    term.addEventListener('pointerleave', () => { clearTimeout(openTimer); closeTimer = setTimeout(close, CLOSE_DELAY); });
    term.addEventListener('focus', () => { if (term.matches(':focus-visible')) open(term, tips); }); // a tap is handled by click
    term.addEventListener('blur', e => { if (!tip.contains(e.relatedTarget)) closeTimer = setTimeout(close, CLOSE_DELAY); });
    term.addEventListener('click', () => (current === term && !hover.matches ? close() : open(term, tips)));
  });
  tip.addEventListener('pointerenter', () => clearTimeout(closeTimer));
  tip.addEventListener('pointerleave', () => { closeTimer = setTimeout(close, CLOSE_DELAY); });
  addEventListener('keydown', e => { if (e.key === 'Escape' && current) { const t = current; close(); t.focus(); } });
  document.addEventListener('pointerdown', e => { if (current && !e.target.closest('.term, .tip')) close(); });
  addEventListener('scroll', () => current && place(current), { passive: true });
  addEventListener('resize', () => current && place(current));
}
