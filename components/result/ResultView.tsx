'use client';

import { type MouseEvent, useCallback, useEffect, useLayoutEffect, useMemo, useReducer, useRef, useState } from 'react';
import type { Chapter, Note, Prefs, Transcript } from '@/lib/types';
import { buildParagraphs, type ExportContext, FORMATS, type Format, languageLine, plainText, summaryPrompt } from '@/lib/transcript';
import { notesMarkdown } from '@/lib/notes';
import { fmtTime, safeFilename, wordCount } from '@/lib/format';
import { thumbUrl, watchUrl } from '@/lib/links';
import { downloadFile, replayClass, scrollBehavior, toast } from '@/lib/browser';
import { useNotes } from '@/hooks/useNotes';
import { usePlayer } from '@/hooks/usePlayer';
import { useFollowAlong } from '@/hooks/useFollowAlong';
import { CopyButton, Downloads, type Format as DownloadFormat } from '../Controls';
import { Icon } from '../Sprite';
import { layoutRows, Transcript as Reader } from './Transcript';
import { NotesPopover } from './NotesPopover';

const WPM = 230;
const FIND_DEBOUNCE_MS = 120;

const DOWNLOADS: DownloadFormat[] = [
  { fmt: 'txt', label: 'Text (.txt)' },
  { fmt: 'md', label: 'Markdown (.md)' },
  { fmt: 'srt', label: 'Subtitles (.srt)' },
  { fmt: 'vtt', label: 'Subtitles (.vtt)' },
  { fmt: 'json', label: 'JSON' },
  { fmt: 'csv', label: 'Spreadsheet (.csv)' },
];

export type ResultProps = {
  videoId: string;
  /** What the reader shows (the source, or a translation of it); null while the first fetch runs. */
  data: Transcript | null;
  /** The transcript as fetched, untranslated. */
  source: Transcript | null;
  chapters: Chapter[];
  /** Chapters didn't load; the transcript is still complete. */
  chaptersFailed: boolean;
  onRetryChapters: () => void;
  prefs: Prefs;
  setPref: <K extends keyof Prefs>(key: K, value: Prefs[K]) => void;
  /** A different language or video is loading, or a translation is running. */
  busy: boolean;
  /** Replaces the caption line while a translation runs. */
  status: string | null;
  translatingTo: string | null;
  fromBulk: boolean;
  onBack: () => void;
  onLanguage: (code: string, generated: boolean) => void;
  onTranslate: (code: string) => void;
};

export function ResultView(props: ResultProps) {
  const { videoId, data, chapters, chaptersFailed, onRetryChapters, prefs, setPref, busy, fromBulk, onBack } = props;
  const readerRef = useRef<HTMLElement>(null);
  const notes = useNotes(videoId);

  const paras = useMemo(
    () => (data ? buildParagraphs(data.snippets, { hideTags: prefs.tags, chapters }) : []),
    [data, prefs.tags, chapters],
  );
  const starts = useMemo(() => paras.map(p => p.start), [paras]);

  /* ---------- Player & follow-along ---------- */

  const timeSink = useRef<(t: number) => void>(() => {});
  const player = usePlayer(videoId, timeSink);
  const follow = useFollowAlong({ readerRef, starts, enabled: prefs.follow, live: player.live, playing: player.playing });
  useLayoutEffect(() => { timeSink.current = follow.onTime; }, [follow.onTime]);

  const { seek } = player;
  const { resume: resumeFollow, pause: pauseFollow } = follow;

  // Timestamps play the embedded video; modifier-clicks (or unembeddable videos) open YouTube.
  const onSeek = useCallback((e: MouseEvent<HTMLAnchorElement>, t: number) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    if (seek(t)) { e.preventDefault(); resumeFollow(); }
  }, [seek, resumeFollow]);

  /* ---------- Find ---------- */

  const [findOpen, setFindOpen] = useState(false);
  const [findFocus, focusFind] = useReducer((n: number) => n + 1, 0);
  const findInputRef = useRef<HTMLInputElement>(null);
  const findOpener = useRef<HTMLButtonElement>(null);
  const [findInput, setFindInput] = useState('');
  const [query, setQuery] = useState('');
  const [hit, setHit] = useState(-1);
  const [scrollTick, scrollToHit] = useReducer((n: number) => n + 1, 0);

  useEffect(() => {
    const t = setTimeout(() => setQuery(findInput.trim().toLowerCase()), FIND_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [findInput]);

  const { rows, hits } = useMemo(() => layoutRows(paras, notes.notes, query), [paras, notes.notes, query]);

  // A new search jumps to its first match; a re-render (say, a new highlight) keeps the current one.
  useEffect(() => { setHit(0); scrollToHit(); }, [query]);
  const shownHit = query && hits ? Math.min(Math.max(hit, 0), hits - 1) : -1;

  useEffect(() => {
    const el = readerRef.current?.querySelector('mark.find.current');
    if (!el) return;
    pauseFollow();
    el.scrollIntoView({ block: 'center', behavior: scrollBehavior() });
  }, [scrollTick, pauseFollow]);

  const step = (by: number) => {
    setHit((shownHit + by + hits) % hits);
    scrollToHit();
  };
  const findKeys = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && hits) {
      e.preventDefault();
      step(e.shiftKey ? -1 : 1);
    }
    if (e.key === 'Escape') { e.stopPropagation(); closeFind(); }
  };
  const closeFind = () => {
    setFindOpen(false);
    setFindInput('');
    setQuery('');
    findOpener.current?.focus();
  };

  // Takes over the browser's find, which can't see past the reader's own marks and can't count them.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.key !== 'f') return;
      e.preventDefault();
      setFindOpen(true);
      focusFind();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);
  useEffect(() => {
    if (!findFocus) return;
    findInputRef.current?.focus();
    findInputRef.current?.select();
  }, [findFocus]);
  const findCount = !findInput.trim() || !query ? '' : hits ? `${shownHit + 1} of ${hits}` : 'No matches';

  /* ---------- Notes ---------- */

  const jumpToNote = (note: Note) => {
    const reader = readerRef.current;
    const mark = reader?.querySelector(`mark.hl[data-note="${note.id}"]`);
    const target = mark ?? reader?.querySelector(`.para[data-start="${note.start}"]`);
    if (!target) return toast('That highlight’s text isn’t in this version of the transcript', { tone: 'bad' });
    pauseFollow();
    target.scrollIntoView({ block: 'center', behavior: scrollBehavior() });
    replayClass(mark, 'fresh');
  };

  /* ---------- Copy & download ---------- */

  const ctx = (): ExportContext => ({ data: data!, paras, chapters, ts: prefs.ts, hideTags: prefs.tags });
  const baseName = () => safeFilename(data!.title || data!.videoId) + (data!.translation ? ` (${data!.translation.code})` : '');

  const download = (fmt: string) => {
    if (fmt === 'notes') return downloadFile(notesMarkdown(notes.notes, data!), `${baseName()} - highlights.md`, 'text/markdown');
    const f = FORMATS[fmt as Format];
    downloadFile(f.fn(ctx()), `${baseName()}.${f.ext}`, f.type);
  };
  const hasNotes = notes.notes.length > 0;
  const downloads = useMemo(() => [...DOWNLOADS, { fmt: 'notes', label: 'Highlights & notes (.md)', disabled: !hasNotes }], [hasNotes]);

  const words = useMemo(() => paras.reduce((n, p) => n + wordCount(p.text), 0), [paras]);
  const last = data?.snippets.at(-1);
  const duration = last ? fmtTime(last.start + last.duration) : '';

  // The chapter holding the paragraph being spoken.
  const spoken = prefs.follow && follow.active >= 0 ? paras[follow.active]?.start : undefined;
  const currentChapter = spoken === undefined ? -1 : chapters.findLastIndex(c => c.start <= spoken + 0.25);

  const jumpToChapter = (t: number) => {
    if (seek(t)) resumeFollow();
    else window.open(watchUrl(videoId, t), '_blank', 'noreferrer');
  };

  return (
    <>
      <section className="page-enter">
        <div className="result" aria-busy={!data}>
          <aside className="side" aria-label="Video and options">
            <div ref={player.slotRef} className="player">
              <button className="poster" type="button" aria-label="Play video here" hidden={player.live} onClick={player.togglePlay}>
                <img className="thumb" src={thumbUrl(videoId)} alt="" />
                <span className="play"><Icon name="play" /></span>
                {duration && <span className="cap num">{duration}</span>}
              </button>
              <div className={player.docked ? 'mini' : 'player-frame'} hidden={!player.live} role={player.docked ? 'region' : undefined} aria-label={player.docked ? 'Video' : undefined}>
                <div ref={player.frameRef} className="frame" />
                {player.docked && (
                  <div className="mini-bar">
                    <span>{data?.title}</span>
                    <button className="icon-btn" type="button" aria-label="Close mini player" onClick={player.dismiss}><Icon name="x" /></button>
                  </div>
                )}
              </div>
            </div>

            <div className="stack">
              {data && <h1 className="video-title">{data.title || 'Untitled video'}</h1>}
              <p className="meta">
                {data?.author && <span>{data.author}</span>}
                {duration && <span className="num">{duration}</span>}
                <a href={watchUrl(videoId)} target="_blank" rel="noreferrer">Open on YouTube</a>
              </p>
            </div>

            {fromBulk && <button className="btn ghost sm" type="button" onClick={onBack}>Back to playlist</button>}

            <Options {...props} onFollow={on => { setPref('follow', on); resumeFollow(); }} />

            {chapters.length > 0 && (
              <section className="stack" aria-labelledby="ch-h">
                <p className="caps" id="ch-h">Chapters</p>
                <ol className="chapters">
                  {chapters.map((c, i) => (
                    <li key={c.start}>
                      <button type="button" aria-current={i === currentChapter ? 'true' : undefined} onClick={() => jumpToChapter(c.start)}>
                        <span className="num">{fmtTime(c.start)}</span><span>{c.title}</span>
                      </button>
                    </li>
                  ))}
                </ol>
              </section>
            )}

            {hasNotes && data && (
              <section className="stack" aria-labelledby="hl-h">
                <div className="card-head">
                  <p className="caps" id="hl-h">Highlights <span className="num">{notes.notes.length}</span></p>
                  <CopyButton className="btn ghost sm" label="Copy" message="Highlights copied" getText={() => notesMarkdown(notes.notes, data)} />
                </div>
                <ul className="chapters">
                  {notes.notes.map(n => (
                    <li key={n.id}>
                      <button type="button" onClick={() => jumpToNote(n)}>
                        <span className="num">{fmtTime(n.start)}</span>
                        <span><span className="note-quote">{n.quote}</span>{n.note && <small>{n.note}</small>}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </aside>

          <section className="stack" aria-label="Transcript">
            <div className="reader-head">
              <div className="row">
                <CopyButton className="btn primary" label="Copy for summary" disabled={!data} message="Copied with a summary prompt. Paste it into Claude"
                  getText={() => summaryPrompt(chapters.length > 0) + plainText(ctx())} />
                <CopyButton label="Copy" disabled={!data} message="Transcript copied" getText={() => plainText(ctx())} />
                <Downloads formats={downloads} onPick={download} disabled={!data} />
              </div>
              <button ref={findOpener} className="btn ghost sm find-open" type="button" hidden={findOpen} onClick={() => { setFindOpen(true); focusFind(); }}>
                <Icon name="search" />Find <span className="kbd">⌘F</span>
              </button>
            </div>

            {data && (
              <p className="muted">
                <span className="num">{paras.length.toLocaleString()}</span> {paras.length === 1 ? 'paragraph' : 'paragraphs'}
                {chapters.length > 0 && <> · <span className="num">{chapters.length}</span> {chapters.length === 1 ? 'chapter' : 'chapters'}</>}
                {' · '}<span className="num">{words.toLocaleString()}</span> words
                {' · '}about <span className="num">{Math.max(1, Math.round(words / WPM))}</span> min to read
              </p>
            )}
            <p className="muted" role="status">{captionLine(props)}</p>

            {findOpen && (
              <div className="find-bar" role="search">
                <Icon name="search" />
                <input ref={findInputRef} id="find" className="input" type="search" value={findInput} onChange={e => setFindInput(e.target.value)} onKeyDown={findKeys}
                  placeholder="Find in transcript" autoComplete="off" aria-label="Find in transcript" />
                <span className="count num" aria-live="polite">{findCount}</span>
                <button className="icon-btn" type="button" aria-label="Previous match" disabled={!hits} onClick={() => step(-1)}><Icon name="up" /></button>
                <button className="icon-btn" type="button" aria-label="Next match" disabled={!hits} onClick={() => step(1)}><Icon name="down" /></button>
                <button className="icon-btn" type="button" aria-label="Close find" onClick={closeFind}><Icon name="x" /></button>
              </div>
            )}

            {chaptersFailed && (
              <div className="notice" data-tone="warn" role="status">
                <Icon name="warn" />
                <div>
                  <strong>Chapters didn’t load</strong>
                  <p>The transcript is complete.</p>
                  <button className="btn sm" type="button" onClick={onRetryChapters}><Icon name="refresh" />Retry chapters</button>
                </div>
              </div>
            )}

            <Reader readerRef={readerRef} rows={rows} loading={!data} ts={prefs.ts} busy={busy} videoId={videoId}
              active={prefs.follow ? follow.active : -1} currentHit={shownHit} onSeek={onSeek} />
          </section>
        </div>
      </section>

      <NotesPopover readerRef={readerRef} notes={notes} />
      <button className="btn now-pill" type="button" hidden={!follow.lost}
        // Blur first: hiding a focused button makes Chromium cancel the smooth scroll back.
        onClick={e => { e.currentTarget.blur(); resumeFollow(); }}>
        <Icon name="down" />Back to now
      </button>
    </>
  );
}

function captionLine({ data, status }: ResultProps) {
  if (!data) return 'Fetching transcript…';
  return status || languageLine(data) + (data.translation?.onDevice ? ' · on this device' : '');
}

/* ---------- Options ---------- */

function Options({ data, source, prefs, setPref, busy, translatingTo, onLanguage, onTranslate, onFollow }: ResultProps & { onFollow: (on: boolean) => void }) {
  // Show a new language pick straight away, while it loads.
  const [langPick, setLangPick] = useState<string | null>(null);
  useEffect(() => { if (!busy) setLangPick(null); }, [busy, source]);

  const tracks = source?.languages ?? [];
  const translations = source?.translationLanguages ?? [];
  const langValue = langPick ?? (source ? `${source.languageCode}|${source.isGenerated ? 1 : 0}` : '');

  return (
    <section className="options" aria-labelledby="opt-h">
      <p className="caps" id="opt-h">Options</p>
      <Switch label="Timestamps" hint="Click one to jump the video there" checked={prefs.ts} onChange={on => setPref('ts', on)} />
      <Switch label="Follow along" hint="Highlight and scroll with the video" checked={prefs.follow} onChange={onFollow} />
      <Switch label="Hide sound cues" hint="[Music], [Applause], ♪" checked={prefs.tags} onChange={on => setPref('tags', on)} />
      <div className="field">
        <label htmlFor="lang">Language</label>
        <div className="select">
          <select id="lang" className="input" value={langValue} disabled={tracks.length < 2} aria-describedby="lang-hint"
            onChange={e => {
              const [code, generated] = e.target.value.split('|');
              setLangPick(e.target.value);
              onLanguage(code, generated === '1');
            }}>
            {tracks.map(l => <option key={`${l.code}|${l.generated}`} value={`${l.code}|${l.generated ? 1 : 0}`}>{l.name}</option>)}
          </select>
          <Icon name="chev" />
        </div>
        <small className="muted" id="lang-hint">{source ? (source.isGenerated ? 'Auto-generated captions' : 'Captions by the creator') : ''}</small>
      </div>
      <div className="field">
        <label htmlFor="tlang">Translate</label>
        <div className="select">
          <select id="tlang" className="input" value={translatingTo ?? data?.translation?.code ?? ''} aria-describedby="tlang-hint"
            disabled={!translations.length || translatingTo != null} onChange={e => onTranslate(e.target.value)}>
            <option value="">Original</option>
            {translations.map(l => <option key={l.code} value={l.code}>{l.name}</option>)}
          </select>
          <Icon name="chev" />
        </div>
        <small className="muted" id="tlang-hint">
          {!source ? '' : !translations.length ? 'Not offered for this video' : data?.translation?.onDevice ? 'Translated on this device' : 'Via YouTube'}
        </small>
      </div>
    </section>
  );
}

function Switch({ label, hint, checked, onChange }: { label: string; hint: string; checked: boolean; onChange: (on: boolean) => void }) {
  return (
    <label className="switch">
      <span>{label}<small>{hint}</small></span>
      <input type="checkbox" role="switch" checked={checked} onChange={e => onChange(e.target.checked)} />
    </label>
  );
}
