// Fetching captions. This follows the same route as the youtube-transcript-api Python package:
// read the API key off the watch page, ask the InnerTube player (as the Android app) for the
// caption tracks, then download the chosen track's timed text.

import type { Track, Transcript, TranslationLanguage, Snippet } from '../types';
import { ApiError, YouTubeError } from './errors';
import { Session, fetchWatchPage, decodeEntities, textOf } from './session';
import { rememberChapters } from './chapters';

const PREFERRED_LANGS = ['en', 'en-US', 'en-GB'];
const ANDROID = { clientName: 'ANDROID', clientVersion: '20.10.38' };
const ANDROID_UA = `com.google.android.youtube/${ANDROID.clientVersion} (Linux; U; Android 14) gzip`;

const BOT_CHECK = 'not a bot';
const AGE_CHECK = 'inappropriate for some users';
const UNAVAILABLE = 'This video is unavailable';

type CaptionTrack = Track & { url: string; translatable: boolean };

export type TranscriptRequest = { lang?: string | null; auto?: boolean; tlang?: string | null };

export async function fetchTranscript(videoId: string, { lang, auto = false, tlang }: TranscriptRequest = {}): Promise<Transcript> {
  const session = new Session();
  const html = await fetchWatchPage(session, videoId);
  rememberChapters(videoId, html);

  const player = await fetchPlayer(session, videoId, html);
  const { tracks, translationLanguages } = captionsOf(player);
  const track = pick(tracks, lang, auto);

  let translation: Transcript['translation'] = null;
  let snippets: Snippet[];
  if (tlang && tlang !== track.code) {
    const target = translationLanguages.find(l => l.code === tlang);
    if (!track.translatable || !target) throw new YouTubeError('not_translatable');
    translation = { code: tlang, name: target.name };
    try {
      snippets = await fetchSnippets(session, `${track.url}&tlang=${encodeURIComponent(tlang)}`);
    } catch (e) {
      // YouTube throttles translated tracks far harder than originals; the client falls back
      // to on-device translation when it sees this code.
      if (e instanceof YouTubeError && (e.kind === 'blocked' || e.kind === 'request_failed')) {
        throw new ApiError(429, 'YouTube is rate-limiting translations from this network right now.', 'translate_blocked', e.message);
      }
      throw e;
    }
  } else {
    snippets = await fetchSnippets(session, track.url);
  }

  const details = player.videoDetails ?? {};
  const { title, author } = details.title ? details : await fetchOEmbed(videoId);
  return {
    videoId,
    title: title || '',
    author: author || '',
    language: track.name,
    languageCode: track.code,
    isGenerated: track.generated,
    translation,
    languages: tracks.map(({ code, name, generated }) => ({ code, name, generated })),
    translationLanguages: track.translatable ? translationLanguages : [],
    snippets,
  };
}

async function fetchPlayer(session: Session, videoId: string, html: string): Promise<any> {
  const key = html.match(/"INNERTUBE_API_KEY":\s*"([a-zA-Z0-9_-]+)"/)?.[1];
  if (!key) {
    if (html.includes('class="g-recaptcha"')) throw new YouTubeError('blocked', 'YouTube asked for a captcha');
    throw new YouTubeError('request_failed', 'No InnerTube API key on the watch page');
  }
  const res = await session.fetch(`https://www.youtube.com/youtubei/v1/player?key=${key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'User-Agent': ANDROID_UA },
    body: JSON.stringify({ context: { client: ANDROID }, videoId }),
  });
  const player = await res.json();
  assertPlayable(player.playabilityStatus);
  return player;
}

function assertPlayable(status: any) {
  if (!status?.status || status.status === 'OK') return;
  const reason: string = status.reason || '';
  if (status.status === 'LOGIN_REQUIRED') {
    if (reason.includes(BOT_CHECK)) throw new YouTubeError('blocked', reason);
    if (reason.includes(AGE_CHECK)) throw new YouTubeError('age_restricted', reason);
  }
  if (status.status === 'ERROR' && reason.includes(UNAVAILABLE)) throw new YouTubeError('unavailable', reason);
  const sub = textOf(status.errorScreen?.playerErrorMessageRenderer?.subreason);
  throw new YouTubeError('unplayable', [reason || status.status, sub].filter(Boolean).join(': '));
}

function captionsOf(player: any): { tracks: CaptionTrack[]; translationLanguages: TranslationLanguage[] } {
  const list = player.captions?.playerCaptionsTracklistRenderer;
  if (!list?.captionTracks?.length) throw new YouTubeError('disabled');

  // One track per language and kind (a later duplicate wins); creator tracks come first.
  const manual = new Map<string, CaptionTrack>(), generated = new Map<string, CaptionTrack>();
  for (const t of list.captionTracks) {
    const track: CaptionTrack = {
      code: t.languageCode,
      name: textOf(t.name) || t.languageCode,
      generated: t.kind === 'asr',
      translatable: !!t.isTranslatable,
      url: String(t.baseUrl).replace('&fmt=srv3', ''),
    };
    (track.generated ? generated : manual).set(track.code, track);
  }
  return {
    tracks: [...manual.values(), ...generated.values()],
    translationLanguages: (list.translationLanguages || []).map((l: any) => ({ code: l.languageCode, name: textOf(l.languageName) })),
  };
}

/**
 * The track to show: the requested language (or English), as the requested kind if it exists,
 * else auto-generated. With no language asked for and no English at all, any creator track,
 * else whatever there is.
 */
function pick(tracks: CaptionTrack[], lang: string | null | undefined, auto: boolean): CaptionTrack {
  const wanted = lang ? [lang] : PREFERRED_LANGS;
  const first = (generated: boolean) => {
    for (const code of wanted) {
      const t = tracks.find(t => t.code === code && t.generated === generated);
      if (t) return t;
    }
  };
  const track = first(auto) ?? first(true) ?? (lang ? undefined : tracks.find(t => !t.generated) ?? tracks[0]);
  if (!track) throw new YouTubeError('not_found');
  return track;
}

async function fetchSnippets(session: Session, url: string): Promise<Snippet[]> {
  if (url.includes('&exp=xpe')) throw new YouTubeError('po_token', 'These captions need a PO token');
  const xml = await (await session.fetch(url)).text();
  const snippets: Snippet[] = [];
  for (const [, attrs, body] of xml.matchAll(/<text\b([^>]*?)(?:\/>|>([\s\S]*?)<\/text>)/g)) {
    if (body == null) continue; // an empty cue
    const attr = (name: string) => attrs.match(new RegExp(`\\b${name}="([^"]*)"`))?.[1];
    snippets.push({
      start: Number(attr('start') ?? 0),
      duration: Number(attr('dur') ?? 0),
      // Captions are entity-encoded twice (once as XML, once as HTML), and may carry <font> tags.
      text: decodeEntities(decodeEntities(body)).replace(/<[^>]*>/g, ''),
    });
  }
  return snippets;
}

async function fetchOEmbed(videoId: string): Promise<{ title: string; author: string }> {
  try {
    const url = `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(`https://www.youtube.com/watch?v=${videoId}`)}`;
    const data = await (await fetch(url, { signal: AbortSignal.timeout(8000) })).json();
    return { title: data.title || '', author: data.author_name || '' };
  } catch {
    return { title: '', author: '' };
  }
}
