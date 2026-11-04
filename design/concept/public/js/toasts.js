// Toasts: a stack in the corner (the top on phones). The newest sits in front; up to two more peek out behind it.
// The timer, not the bar, closes a toast. Hovering, focusing or leaving the window holds every timer and fans the stack out.
const VISIBLE = 3;   // cards drawn; the rest wait invisibly
const CAP = 5;       // older ones beyond this are dropped
const LIFT = 10;     // px each card behind peeks out
const SHRINK = 0.05; // scale lost per card behind
const GAP = 8;       // px between cards when fanned out

const dock = document.getElementById('toasts');
const live = document.getElementById('live');
const top = matchMedia('(max-width: 560px)');
const stack = []; // oldest first
let held = false;

const ICON = { good: 'i-check', bad: 'i-x', accent: 'i-info' };

function layout() {
  const sign = top.matches ? 1 : -1;
  const front = stack.at(-1);
  let y = 0;
  [...stack].reverse().forEach((t, i) => {
    const { el } = t;
    if (held) {
      el.style.height = `${t.h}px`;
      el.style.translate = `0 ${sign * y}px`;
      el.style.scale = '1';
      y += t.h + GAP;
    } else {
      el.style.height = `${front.h}px`;
      el.style.translate = `0 ${sign * i * LIFT}px`;
      el.style.scale = `${1 - i * SHRINK}`;
    }
    el.style.zIndex = `${stack.length - i}`;
    el.classList.toggle('behind', !held && i > 0);
    el.classList.toggle('off', i >= VISIBLE);
    el.inert = !held && i > 0;
  });
}

function startTimer(t) { t.start = performance.now(); t.timer = setTimeout(() => dismiss(t), t.left); }
function hold(on) {
  if (held === on) return;
  held = on;
  dock.classList.toggle('held', on);
  for (const t of stack) {
    if (on) { clearTimeout(t.timer); t.left -= performance.now() - t.start; } else startTimer(t);
  }
  layout();
}

function dismiss(t) {
  const i = stack.indexOf(t);
  if (i < 0) return;
  clearTimeout(t.timer);
  stack.splice(i, 1);
  const hadFocus = t.el.contains(document.activeElement);
  t.el.classList.add('leaving');
  setTimeout(() => t.el.remove(), 240);
  if (!stack.length) { hold(false); if (hadFocus && t.opener?.isConnected) t.opener.focus(); }
  else if (hadFocus) stack.at(-1).el.querySelector('button')?.focus();
  layout();
}

/** toast({ tone: 'good'|'bad'|'accent', title, body?, action?: { label, run }, ms? }) → dismiss() */
export function toast({ tone = 'good', title, body = '', action, ms = 5000 }) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.dataset.tone = tone;
  el.style.setProperty('--ms', `${ms}ms`);
  el.innerHTML = `<span class="toast-icon" aria-hidden="true"><svg class="icon"><use href="#${ICON[tone]}"/></svg></span><div class="toast-body"><strong></strong><p></p></div><button class="close-btn" type="button" aria-label="Dismiss"><svg class="icon" aria-hidden="true"><use href="#i-x"/></svg></button><span class="toast-time"></span>`;
  el.querySelector('strong').textContent = title;
  const p = el.querySelector('p');
  body ? (p.textContent = body) : p.remove();
  const t = { el, left: ms, opener: document.activeElement };
  if (action) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'link-btn toast-action';
    b.textContent = action.label;
    b.addEventListener('click', () => { action.run(); dismiss(t); });
    el.querySelector('.toast-body').append(b);
  }
  el.querySelector('.close-btn').addEventListener('click', () => dismiss(t));
  dock.append(el);
  t.h = el.offsetHeight;
  stack.push(t);
  while (stack.length > CAP) dismiss(stack[0]);
  if (!held) startTimer(t); else t.start = performance.now();
  layout();
  live.textContent = '';
  requestAnimationFrame(() => { live.textContent = body ? `${title}. ${body}` : title; });
  return () => dismiss(t);
}

dock.addEventListener('pointerenter', () => hold(true));
dock.addEventListener('pointerleave', () => { if (!dock.contains(document.activeElement)) hold(false); });
dock.addEventListener('focusin', () => hold(true));
dock.addEventListener('focusout', e => { if (!dock.contains(e.relatedTarget) && !dock.matches(':hover')) hold(false); });
addEventListener('blur', () => stack.length && hold(true));
addEventListener('focus', () => { if (!dock.matches(':hover') && !dock.contains(document.activeElement)) hold(false); });
addEventListener('keydown', e => {
  if (e.key !== 'Escape' || !stack.length || document.querySelector('dialog[open]') || document.querySelector('#menu[data-open]')) return;
  dismiss(stack.at(-1));
});
top.addEventListener('change', layout);
