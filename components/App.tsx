'use client';

// The whole client: routing between the three views, loading transcripts, and translation.
//
// URLs:  /?v=<id or full link>   one video (the bookmarklet sends a full link)
//        /?list=<id>             a playlist
//        /?videos=<id,id,…>      several pasted links
//        /?playlist              the empty playlist page

import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { Chapter, Transcript } from '@/lib/types';
import { playlistIdFrom, videoIdFrom, videoIdsIn } from '@/lib/links';
import { api, ApiError, toast } from '@/lib/browser';
import { type BulkSource, createBulkQueue } from '@/lib/bulk';
import { onDeviceAvailable, translateOnDevice } from '@/lib/translate';
import { usePrefs } from '@/hooks/usePrefs';
import { LinkForm, TopBar } from './TopBar';
import { Landing, rememberRecent, type ShownError } from './Landing';
import { ResultView } from './result/ResultView';
import { BulkView } from './BulkView';
import { Icon } from './Sprite';

type View = 'landing' | 'result' | 'bulk';
export type InitialQuery = { v?: string; list?: string; videos?: string; playlist?: boolean };
type OpenOptions = { push?: boolean; data?: Transcript | null; fromBulk?: boolean; lang?: { code: string; generated: boolean } | null };

const NOT_A_LINK: ShownError = {
  message: 'That doesn’t look like a YouTube link.',
  detail: 'Paste a youtube.com or youtu.be link, a playlist, or several links at once.',
  field: true,
};

/** Decide what a pasted string is: several videos or a playlist, one video, or nothing we know. */
function classify(raw: string): { bulk: BulkSource } | { video: string } | null {
  const ids = videoIdsIn(raw);
  if (ids.length > 1) return { bulk: { ids } };
  const list = playlistIdFrom(raw);
  if (list) return { bulk: { list, url: raw } };
  const id = ids[0] || videoIdFrom(raw);
  return id ? { video: id } : null;
}

/** Match the first render to the URL, so the server sends the right view's shell. */
function initialView({ v, list, videos, playlist }: InitialQuery): { view: View; pendingId: string | null } {
  if (v) {
    const what = classify(v);
    if (what && 'video' in what) return { view: 'result', pendingId: what.video };
    if (what) return { view: 'bulk', pendingId: null };
  }
  if (list || videos || playlist) return { view: 'bulk', pendingId: null };
  return { view: 'landing', pendingId: null };
}

function setUrl(search: string, push: boolean) {
  if (location.search === search) return;
  history[push ? 'pushState' : 'replaceState'](null, '', search || '/');
}

export function App({ initial }: { initial: InitialQuery }) {
  const [start] = useState(() => initialView(initial));
  const [view, setView] = useState<View>(start.view);
  /** The video whose transcript is loading for the first time (the reader shows a skeleton). */
  const [pendingId, setPendingId] = useState(start.pendingId);
  /** The transcript as fetched, untranslated. */
  const [source, setSource] = useState<Transcript | null>(null);
  /** What the reader shows: the source, or a translation of it. */
  const [data, setData] = useState<Transcript | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [chaptersFailed, setChaptersFailed] = useState(false);
  const [fromBulk, setFromBulk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ShownError | null>(null);
  const [heroUrl, setHeroUrl] = useState('');
  const [miniUrl, setMiniUrl] = useState('');
  const [translatingTo, setTranslatingTo] = useState<string | null>(null);
  const [captionOverride, setCaptionOverride] = useState<string | null>(null);
  const [prefs, setPref] = usePrefs();
  const [queue] = useState(createBulkQueue);
  const queued = useSyncExternalStore(queue.subscribe, () => !!queue.key, () => false);

  const loadGen = useRef(0);        // bumps whenever a different transcript or batch is requested
  const translateSeq = useRef(0);   // bumps on every Translate pick, so only the latest one lands
  const translateAbort = useRef<AbortController | null>(null);
  const translateLocally = useRef(false); // YouTube refused a translation this session; go straight to on-device

  // Async handlers below read the latest state through this ref.
  const latest = useRef({ view, data, source });
  useLayoutEffect(() => { latest.current = { view, data, source }; });

  /* ---------- Opening things ---------- */

  function go(raw: string, push = true) {
    raw = raw.trim();
    setError(null);
    if (!raw) return;
    const what = classify(raw);
    if (what && 'bulk' in what) return openBulk(what.bulk, push);
    if (what) return openVideo(what.video, { push });
    // Where a hero form is showing, the error belongs under it.
    if (latest.current.view === 'landing' || (latest.current.view === 'bulk' && !queue.key)) setError(NOT_A_LINK);
    else toast(NOT_A_LINK.message, { tone: 'bad' });
  }

  async function openVideo(id: string, { push = true, data = null, fromBulk = false, lang = null }: OpenOptions = {}) {
    const gen = ++loadGen.current;
    const from = latest.current.view;
    const skeleton = from === 'result' && !latest.current.data; // straight from a URL: nothing else to show yet
    if (!fromBulk && from !== 'result') queue.cancel();

    if (!data) {
      if (!skeleton) setBusy(true);
      try {
        data = await api<Transcript>('/api/transcript', { url: id, lang: lang?.code, auto: lang?.generated });
      } catch (err) {
        if (gen !== loadGen.current) return;
        setBusy(false);
        if ((from === 'result' && !skeleton) || from === 'bulk') return toast((err as Error).message, { tone: 'bad' });
        setView('landing');
        setPendingId(null);
        setHeroUrl(id);
        setError(err as ApiError);
        return;
      }
      if (gen !== loadGen.current) return;
      setBusy(false);
    }

    const sameVideo = latest.current.source?.videoId === data.videoId;
    translateAbort.current?.abort();
    setSource(data);
    setData(data);
    setFromBulk(fromBulk);
    setTranslatingTo(null);
    setCaptionOverride(null);
    if (!sameVideo) { setChapters([]); setChaptersFailed(false); }
    setPendingId(null);
    setView('result');
    setUrl(`?v=${data.videoId}`, push);
    document.title = `${data.title || 'Transcript'} · Transcript Grabber`;
    setMiniUrl('');
    setHeroUrl('');

    if (!sameVideo) {
      rememberRecent({ id: data.videoId, title: data.title, author: data.author });
      loadChapters(data.videoId);
    }
  }

  async function loadChapters(id: string) {
    const current = () => latest.current.source?.videoId === id;
    try {
      const { chapters, failed } = await api<{ chapters: Chapter[]; failed?: boolean }>('/api/chapters', { id });
      if (!current()) return;
      if (chapters.length) setChapters(chapters);
      setChaptersFailed(!!failed);
    } catch {
      if (current()) setChaptersFailed(true); // the transcript is fine without them; the reader offers a retry
    }
  }

  async function openBulk(source: BulkSource, push = true) {
    const gen = ++loadGen.current;
    const from = latest.current.view;
    setBusy(false);
    setView('bulk');
    setUrl('list' in source ? `?list=${source.list}` : `?videos=${source.ids.join(',')}`, push);
    setMiniUrl('');
    setHeroUrl('');
    try {
      await queue.start(source);
    } catch (err) {
      if (gen !== loadGen.current) return;
      if (from === 'result') { history.back(); return toast((err as Error).message, { tone: 'bad' }); }
      setView('landing');
      setUrl('', false);
      setError(err as ApiError);
    }
  }

  function route() {
    const q = new URLSearchParams(location.search);
    const { data, source } = latest.current;
    const v = q.get('v'), list = q.get('list'), videos = q.get('videos');
    if (v) {
      const id = videoIdFrom(v);
      if (id && data?.videoId === id && source) return setView('result');
      return go(v, false);
    }
    if (list) {
      if (queue.key === `list:${list}`) return setView('bulk');
      return openBulk({ list }, false);
    }
    if (videos) {
      const ids = videos.split(',').filter(id => videoIdFrom(id));
      if (queue.key === `ids:${ids.join(',')}`) return setView('bulk');
      if (ids.length) return openBulk({ ids }, false);
    }
    ++loadGen.current; // drop anything still loading
    setBusy(false);
    if (q.has('playlist')) return setView('bulk'); // a queue already running stays, and shows
    queue.cancel();
    setView('landing');
  }

  const home = () => {
    if (latest.current.view === 'landing') return;
    setError(null);
    setUrl('', true);
    route();
  };

  const playlists = () => {
    if (latest.current.view === 'bulk') return;
    setError(null);
    setUrl('?playlist', true);
    route();
  };

  /* ---------- Language & translation ---------- */

  const changeLanguage = (code: string, generated: boolean) => {
    if (source) openVideo(source.videoId, { push: false, lang: { code, generated } });
  };

  async function translate(code: string) {
    const src = latest.current.source!;
    translateAbort.current?.abort();
    if (!code) {
      ++translateSeq.current;
      setTranslatingTo(null);
      setCaptionOverride(null);
      setData(src);
      return;
    }
    const target = src.translationLanguages.find(l => l.code === code)!;
    const gen = loadGen.current, seq = ++translateSeq.current;
    const current = () => gen === loadGen.current && seq === translateSeq.current && latest.current.source === src;
    setTranslatingTo(code);
    setCaptionOverride(`Translating to ${target.name}…`);
    try {
      let out: Transcript | null = null;
      if (!translateLocally.current) {
        try {
          out = await api<Transcript>('/api/transcript', { url: src.videoId, lang: src.languageCode, auto: src.isGenerated, tlang: code });
        } catch (err) {
          if (!(err instanceof ApiError) || err.code !== 'translate_blocked' || !onDeviceAvailable()) throw err;
          translateLocally.current = true;
        }
      }
      if (!out) {
        const ctrl = translateAbort.current = new AbortController();
        out = await translateOnDevice(src, target, {
          signal: ctrl.signal,
          onProgress: (f, phase) => {
            if (!current()) return;
            const pct = Math.round(f * 100);
            setCaptionOverride(phase === 'download' ? `Downloading ${target.name} language pack… ${pct}%` : `Translating on this device… ${pct}%`);
          },
        });
      }
      if (current()) setData(out);
    } catch (err) {
      if ((err as Error).name === 'AbortError' || !current()) return;
      toast((err as Error).message, { tone: 'bad' });
      setData(src);
    } finally {
      if (current()) {
        setTranslatingTo(null);
        setCaptionOverride(null);
      }
    }
  }

  /* ---------- Page-wide wiring ---------- */

  // Handlers registered once still need this render's functions.
  const routeRef = useRef(route);
  useLayoutEffect(() => { routeRef.current = route; });

  useEffect(() => {
    routeRef.current();
    const onPop = () => routeRef.current();
    addEventListener('popstate', onPop);
    return () => removeEventListener('popstate', onPop);
  }, []);

  const firstView = useRef(true);
  useEffect(() => {
    scrollTo({ top: 0 });
    if (view === 'landing') document.title = 'Transcript Grabber';
    else if (view === 'bulk') document.title = 'Playlist · Transcript Grabber';
    // The page changed under a screen reader: start it at the new page. The first load keeps the link box's autofocus.
    if (!firstView.current) document.getElementById('main')?.focus({ preventScroll: true });
    firstView.current = false;
  }, [view]);

  /* ---------- Render ---------- */

  const videoId = data?.videoId ?? pendingId;

  return (
    <>
      <a className="skip" href="#main">Skip to content</a>
      <TopBar view={view} onHome={home} onPlaylist={playlists}
        // A page with its own link box doesn't need a second one in the bar.
        mini={(view === 'result' || (view === 'bulk' && queued)) && <LinkForm mini value={miniUrl} onChange={setMiniUrl} onGo={raw => go(raw)} busy={busy} />} />

      <main className="main" id="main" tabIndex={-1}>
        {view === 'landing' && (
          <Landing
            form={<LinkForm value={heroUrl} onChange={setHeroUrl} onGo={raw => go(raw)} busy={busy} error={error} />}
            error={error}
            prefs={prefs}
            setPref={setPref}
            onOpen={id => openVideo(id)}
          />
        )}

        {view === 'result' && videoId && (
          <ResultView
            key={videoId}
            videoId={videoId}
            data={data}
            source={source}
            chapters={chapters}
            chaptersFailed={chaptersFailed}
            onRetryChapters={() => { setChaptersFailed(false); loadChapters(videoId); }}
            prefs={prefs}
            setPref={setPref}
            busy={busy || translatingTo != null}
            status={captionOverride}
            translatingTo={translatingTo}
            fromBulk={fromBulk}
            onBack={() => history.back()}
            onLanguage={changeLanguage}
            onTranslate={translate}
          />
        )}

        {view === 'bulk' && (
          <BulkView queue={queue} prefs={prefs} onOpen={(id, item) => openVideo(id, { data: item, fromBulk: true })}
            form={<LinkForm label="Playlist or video links" value={miniUrl} onChange={setMiniUrl} onGo={raw => go(raw)} busy={busy} error={error} />} />
        )}
      </main>

      <Footer />
    </>
  );
}

const REPO = 'https://github.com/devkilyungi/yt-transcript-grabber';

/** Promises and credit. The AGPL attribution term in NOTICE requires forks to keep the credit. */
function Footer() {
  return (
    <footer className="foot">
      <ul className="promises">
        <li><Icon name="eye-off" />No account, no cookies, no trackers</li>
        <li><Icon name="shield" />Highlights and notes stay on this Mac</li>
        <li><Icon name="info" />Videos play from youtube-nocookie.com</li>
      </ul>
      <p className="credits">
        <a href={REPO} target="_blank" rel="noreferrer">Transcript Grabber</a> by Victor Kilyungi, <a href={`${REPO}/blob/main/LICENSE`} target="_blank" rel="noreferrer">AGPL-3.0</a>.
        {' '}Atkinson Hyperlegible Next and Mono by the Braille Institute, Courier Prime by Alan Dague-Greene, under the SIL Open Font License 1.1.
        {' '}Not affiliated with YouTube, a trademark of Google LLC.
      </p>
      <span className="maker">
        <svg className="mk" width="24" height="16" viewBox="0 0 24 16" strokeWidth="1.5" aria-hidden="true"><rect x="1" y="1.5" width="22" height="6.5" rx="3.25" /><path d="M4.5 4.75h15M4.5 13h10" /></svg>
        © 2026 <a href="https://github.com/devkilyungi" target="_blank" rel="noreferrer">devkilyungi</a>
      </span>
    </footer>
  );
}
