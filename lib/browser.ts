// Browser-side helpers: storage, the API client, feedback, clipboard and downloads.

import type { ErrorBody } from './types';

/* ---------- localStorage (per-browser conveniences; never required) ---------- */

export const store = {
  get<T>(key: string, fallback: T): T {
    try {
      const v = localStorage.getItem(key);
      return v == null ? fallback : JSON.parse(v);
    } catch {
      return fallback;
    }
  },
  set(key: string, value: unknown) {
    try {
      if (value == null || (Array.isArray(value) && !value.length)) localStorage.removeItem(key);
      else localStorage.setItem(key, JSON.stringify(value));
    } catch {}
  },
};

/* ---------- API ---------- */

export class ApiError extends Error {
  code: string;
  detail: string;
  status: number;
  constructor(message: string, { code = '', detail = '', status = 0 } = {}) {
    super(message);
    this.code = code;
    this.detail = detail;
    this.status = status;
  }
}

export async function api<T>(path: string, params: Record<string, string | number | boolean | null | undefined> = {}): Promise<T> {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v != null && v !== '' && v !== false) qs.set(k, v === true ? '1' : String(v));
  }
  let res: Response;
  try {
    res = await fetch(`${path}?${qs}`);
  } catch (e) {
    throw new ApiError('Could not reach the app’s server. Is `npm run dev` still running?', { detail: String(e), code: 'offline' });
  }
  let json: any;
  try { json = await res.json(); } catch { json = { error: 'The server sent an unexpected response.' }; }
  if (!res.ok) {
    const body = json as ErrorBody;
    throw new ApiError(body.error, { code: body.code, detail: body.detail, status: res.status });
  }
  return json as T;
}

/* ---------- Motion & focus ---------- */

export const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
export const scrollBehavior = (): ScrollBehavior => (reducedMotion() ? 'auto' : 'smooth');

/** True while focus is in a text field, where single-letter shortcuts must not fire. */
export const isTyping = (el: Element | null) =>
  !!el && ((el as HTMLElement).isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));

/** Restart a one-shot CSS animation class on an element, e.g. a flash or a nudge. */
export function replayClass(el: Element | null | undefined, cls: string) {
  if (!el || reducedMotion()) return;
  el.classList.remove(cls);
  void (el as HTMLElement).offsetWidth;
  el.classList.add(cls);
  el.addEventListener('animationend', () => el.classList.remove(cls), { once: true });
}

/* ---------- Menus ---------- */

const CLOSE_MENUS = 'tg:close-menus';

/** Close every open dropdown menu. */
export const closeMenus = () => document.dispatchEvent(new Event(CLOSE_MENUS));
export function onCloseMenus(fn: () => void) {
  document.addEventListener(CLOSE_MENUS, fn);
  return () => document.removeEventListener(CLOSE_MENUS, fn);
}

/* ---------- Feedback ---------- */

type ToastListener = (msg: string) => void;
const toastListeners = new Set<ToastListener>();

/** Show a short message in the toast at the bottom of the page. */
export function toast(msg: string) {
  toastListeners.forEach(fn => fn(msg));
}
export function onToast(fn: ToastListener) {
  toastListeners.add(fn);
  return () => { toastListeners.delete(fn); };
}

const doneTimers = new WeakMap<Element, number>();

/** Briefly swap a button's icon for a check mark. */
export function flashDone(btn: Element | null | undefined) {
  if (!btn) return;
  btn.classList.add('done');
  clearTimeout(doneTimers.get(btn));
  doneTimers.set(btn, window.setTimeout(() => btn.classList.remove('done'), 1400));
}

export async function copyText(text: string, msg: string, btn?: Element | null) {
  try {
    await navigator.clipboard.writeText(text);
    flashDone(btn);
    toast(msg);
  } catch {
    toast('Copy failed. Your browser blocked clipboard access');
  }
}

export function downloadFile(content: string, name: string, type: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([content], { type }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  toast(`Saved ${name}`);
}

/* ---------- Theme ---------- */

export function toggleTheme() {
  const root = document.documentElement;
  const current = root.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  const next = current === 'dark' ? 'light' : 'dark';
  const apply = () => { root.dataset.theme = next; };
  if (document.startViewTransition && !reducedMotion()) document.startViewTransition(apply);
  else apply();
  try { localStorage.setItem('tg.theme', next); } catch {}
}
