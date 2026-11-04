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
    throw new ApiError('Couldn’t reach the app’s server.', { detail: 'Quit Transcript Grabber and open it again.', code: 'offline' });
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

/* ---------- Feedback ---------- */

type ToastOptions = { tone?: 'good' | 'bad'; action?: { label: string; run: () => void } };

/** A toast from the kit's dock: 4s for good news, 8s for bad. Its module touches the document as it loads, so it is imported on first use. */
export function toast(title: string, { tone = 'good', action }: ToastOptions = {}) {
  import('./house/toasts.js').then(t => t.toast({ tone, title, action, ms: tone === 'bad' ? 8000 : 4000 }));
}

export async function copyText(text: string, msg: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast(msg);
    return true;
  } catch {
    toast('Copy failed. The system blocked clipboard access; try again.', { tone: 'bad' });
    return false;
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
