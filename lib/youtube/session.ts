// A cookie-keeping HTTP session for youtube.com, and the watch page every lookup starts from.

import { YouTubeError } from './errors';

const TIMEOUT_MS = 15_000;
const BROWSER_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36';
const CONSENT_FORM = 'action="https://consent.youtube.com/s"';

/** Keeps the cookies YouTube sets on the watch page for the calls that follow it. */
export class Session {
  #cookies = new Map<string, string>();

  setCookie(name: string, value: string) {
    this.#cookies.set(name, value);
  }

  async fetch(url: string, init: RequestInit = {}): Promise<Response> {
    const headers = new Headers(init.headers);
    headers.set('Accept-Language', 'en-US');
    if (!headers.has('User-Agent')) headers.set('User-Agent', BROWSER_UA);
    if (this.#cookies.size) headers.set('Cookie', [...this.#cookies].map(([k, v]) => `${k}=${v}`).join('; '));

    const res = await fetch(url, { ...init, headers, cache: 'no-store', signal: init.signal ?? AbortSignal.timeout(TIMEOUT_MS) });
    for (const cookie of res.headers.getSetCookie()) {
      const pair = cookie.split(';', 1)[0];
      const eq = pair.indexOf('=');
      if (eq > 0) this.#cookies.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
    }
    if (res.status === 429) throw new YouTubeError('blocked', `HTTP 429 from ${new URL(url).pathname}`);
    if (!res.ok) throw new YouTubeError('request_failed', `HTTP ${res.status} from ${new URL(url).pathname}`);
    return res;
  }
}

/** The video's watch page, accepting YouTube's cookie consent (shown to EU visitors) if it asks. */
export async function fetchWatchPage(session: Session, videoId: string): Promise<string> {
  const get = async () => (await session.fetch(`https://www.youtube.com/watch?v=${videoId}`)).text();
  let html = await get();
  if (html.includes(CONSENT_FORM)) {
    const v = html.match(/name="v" value="(.*?)"/)?.[1];
    if (!v) throw new YouTubeError('request_failed', 'Couldn’t accept YouTube’s cookie consent');
    session.setCookie('CONSENT', `YES+${decodeEntities(v)}`);
    html = await get();
    if (html.includes(CONSENT_FORM)) throw new YouTubeError('request_failed', 'Couldn’t accept YouTube’s cookie consent');
  }
  return html;
}

const NAMED: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

/** Decode HTML/XML character references (&amp; &#39; &#x27; …). */
export function decodeEntities(s: string): string {
  return s.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (whole, ref: string) => {
    if (ref[0] === '#') {
      const code = ref[1] === 'x' || ref[1] === 'X' ? parseInt(ref.slice(2), 16) : parseInt(ref.slice(1), 10);
      return Number.isFinite(code) && code <= 0x10ffff ? String.fromCodePoint(code) : whole;
    }
    return NAMED[ref.toLowerCase()] ?? whole;
  });
}

/**
 * The JSON object assigned to `name` in one of the page's inline scripts
 * (`var ytInitialData = {...};`), found by matching braces rather than by regex.
 */
export function inlineJson(html: string, name: string): any {
  const at = html.search(new RegExp(`(?:var |window\\[["'])${name}(?:["']\\])?\\s*=\\s*\\{`));
  if (at < 0) return null;
  const start = html.indexOf('{', at);
  let depth = 0, inString = false, escaped = false;
  for (let i = start; i < html.length; i++) {
    const c = html[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (c === '\\') escaped = true;
      else if (c === '"') inString = false;
    } else if (c === '"') inString = true;
    else if (c === '{') depth++;
    else if (c === '}' && --depth === 0) {
      try { return JSON.parse(html.slice(start, i + 1)); } catch { return null; }
    }
  }
  return null;
}

/** YouTube's text objects come as { simpleText } or { runs: [{ text }] }. */
export const textOf = (t: any): string => t?.simpleText ?? t?.runs?.map((r: any) => r.text).join('') ?? '';
