// YouTube link parsing, shared by the API routes and the client (so the UI can show
// thumbnails and route before anything is fetched).

const ID_RE = /^[\w-]{11}$/;
const LIST_RE = /^[\w-]{10,64}$/;

export const isVideoId = (s: string) => ID_RE.test(s);

function parseUrl(raw: string): URL | null {
  try { return new URL(raw.includes('://') ? raw : 'https://' + raw); } catch { return null; }
}
const isYouTubeHost = (host: string) => /^(www\.|m\.|music\.)?(youtube\.com|youtube-nocookie\.com)$/i.test(host);
const isShortHost = (host: string) => /^(www\.)?youtu\.be$/i.test(host);

/** A video id from a bare id or any watch, youtu.be, /shorts/, /embed/, /live/ or /v/ link. */
export function videoIdFrom(raw: string): string | null {
  raw = raw.trim();
  if (ID_RE.test(raw)) return raw;
  const u = parseUrl(raw);
  if (!u) return null;
  let id = '';
  if (isShortHost(u.hostname)) id = u.pathname.split('/')[1] || '';
  else if (isYouTubeHost(u.hostname)) id = u.searchParams.get('v') || u.pathname.split('/').filter(Boolean)[1] || '';
  return ID_RE.test(id) ? id : null;
}

/**
 * A playlist id from a link that names a playlist and no particular video.
 * `bare` also accepts the id on its own (the API takes either).
 */
export function playlistIdFrom(raw: string, { bare = false } = {}): string | null {
  raw = raw.trim();
  if (bare && LIST_RE.test(raw) && !ID_RE.test(raw)) return raw;
  const u = parseUrl(raw);
  if (!u || !(isYouTubeHost(u.hostname) || isShortHost(u.hostname))) return null;
  const list = u.searchParams.get('list');
  return list && LIST_RE.test(list) && !videoIdFrom(raw) ? list : null;
}

export const looksLikeLink = (s: string) => /youtu\.?be|^[\w-]{11}$/.test(s.trim());

/** Every YouTube video link in a block of pasted text, de-duplicated. */
export function videoIdsIn(text: string): string[] {
  const ids = (text.match(/\S+/g) || []).map(videoIdFrom).filter((id): id is string => !!id);
  return [...new Set(ids)];
}

export const watchUrl = (id: string, t?: number) =>
  `https://www.youtube.com/watch?v=${id}` + (t != null ? `&t=${Math.floor(t)}s` : '');
export const thumbUrl = (id: string) => `https://i.ytimg.com/vi/${id}/mqdefault.jpg`;
