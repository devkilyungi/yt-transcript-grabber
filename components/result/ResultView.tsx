'use client';

import { type MouseEvent, useCallback, useEffect, useLayoutEffect, useMemo, useReducer, useRef, useState } from 'react';
import type { Chapter, Note, Prefs, Transcript } from '@/lib/types';
import { buildParagraphs, type ExportContext, FORMATS, type Format, languageLine, plainText, summaryPrompt } from '@/lib/transcript';
import { notesMarkdown } from '@/lib/notes';
import { fmtTime, safeFilename, wordCount } from '@/lib/format';
import { thumbUrl, watchUrl } from '@/lib/links';
import { copyText, downloadFile, replayClass, scrollBehavior, toast } from '@/lib/browser';
import { useNotes } from '@/hooks/useNotes';
import { usePlayer } from '@/hooks/usePlayer';
import { useFollowAlong } from '@/hooks/useFollowAlong';
import { DownloadMenu, type MenuEntry } from '../DownloadMenu';
import { BackIcon, CloseIcon, CopyIcon, DoneSwap, ExternalIcon, PlayIcon, SearchIcon, SparkleIcon } from '../icons';
import { layoutRows, Transcript as Reader } from './Transcript';
import { NotesPopover } from './NotesPopover';

const WPM = 230;
const FIND_DEBOUNCE_MS = 120;

const DOWNLOADS: MenuEntry[] = [
  { heading: 'Read' },
  { fmt: 'txt', label: 'Plain text', ext: 'txt' },
  { fmt: 'md', label: 'Markdown', ext: 'md' },
  { heading: 'Subtitles' },
  { fmt: 'srt', label: 'SubRip', ext: 'srt' },
  { fmt: 'vtt', label: 'WebVTT', ext: 'vtt' },
  { heading: 'Data' },
  { fmt: 'json', label: 'JSON', ext: 'json' },
  { fmt: 'csv', label: 'Spreadsheet', ext: 'csv' },
  { divider: true },
];

export type ResultProps = {
  videoId: string;
  /** What the reader shows (the source, or a translation of it); null while the first fetch runs. */
  data: Transcript | null;
  /** The transcript as fetched, untranslated. */
  source: Transcript | null;
  chapters: Chapter[];
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
  const { videoId, data, chapters, prefs, setPref, busy, fromBulk, onBack } = props;
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
    const el = readerRef.current?.querySelector('mark.f.current');
    if (!el) return;
    pauseFollow();
    el.scrollIntoView({ block: 'center', behavior: scrollBehavior() });
  }, [scrollTick, pauseFollow]);

  const findKeys = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && hits) {
      e.preventDefault();
      setHit((shownHit + (e.shiftKey ? -1 : 1) + hits) % hits);
      scrollToHit();
    }
    if (e.key === 'Escape' && findInput) { e.stopPropagation(); setFindInput(''); setQuery(''); }
  };
  const findCount = !findInput.trim() || !query ? '' : hits ? `${shownHit + 1} of ${hits}` : 'No matches';

  /* ---------- Notes ---------- */

  const jumpToNote = (note: Note) => {
    const reader = readerRef.current;
    const mark = reader?.querySelector(`mark.hl[data-note="${note.id}"]`);
    const target = mark ?? reader?.querySelector(`.para[data-start="${note.start}"]`);
    if (!target) return toast('That highlight’s text isn’t in this version of the transcript');
    pauseFollow();
    target.scrollIntoView({ block: 'center', behavior: scrollBehavior() });
    replayClass(mark, 'flash');
  };

  /* ---------- Copy & download ---------- */

  const ctx = (): ExportContext => ({ data: data!, paras, chapters, ts: prefs.ts, hideTags: prefs.tags });
  const baseName = () => safeFilename(data!.title || data!.videoId) + (data!.translation ? ` (${data!.translation.code})` : '');

  const download = (fmt: string) => {
    if (fmt === 'notes') return downloadFile(notesMarkdown(notes.notes, data!), `${baseName()} - highlights.md`, 'text/markdown');
    const f = FORMATS[fmt as Format];
    downloadFile(f.fn(ctx()), `${baseName()}.${f.ext}`, f.type);
  };
  const downloads = useMemo<MenuEntry[]>(
    () => [...DOWNLOADS, { fmt: 'notes', label: 'Highlights & notes', ext: 'md', disabled: !notes.notes.length }],
    [notes.notes.length],
  );

  const words = useMemo(() => paras.reduce((n, p) => n + wordCount(p.text), 0), [paras]);
  const last = data?.snippets.at(-1);

  return (
    <>
      <main className="result view">
        <aside className="side">
          <div className="card video-card">
            <div ref={player.slotRef} className={`player-slot${player.live ? ' live' : ''}`}>
              <button className="poster" type="button" aria-label="Play video here" onClick={player.togglePlay}>
                <img src={thumbUrl(videoId)} alt="" />
                <span className="play"><PlayIcon /></span>
                <span className="dur">{last ? fmtTime(last.start + last.duration) : ''}</span>
              </button>
              <div ref={player.frameRef} className={`frame${player.docked ? ' docked' : ''}`} />
            </div>
            <div className="video-meta">
              <h2>{data ? data.title || 'Untitled video' : ''}</h2>
              <div className="author">
                <span>{data?.author}</span>
                <a href={watchUrl(videoId)} target="_blank" rel="noopener" title="Open on YouTube">
                  <ExternalIcon />
                  YouTube
                </a>
              </div>
            </div>
            <div className="stats">
              <div className="stat"><b>{data ? words.toLocaleString() : '–'}</b><span>words</span></div>
              <div className="stat"><b>{data ? `${Math.max(1, Math.round(words / WPM))} min` : '–'}</b><span>read time</span></div>
              <div className="stat">
                <b>{data ? (chapters.length || paras.length).toLocaleString() : '–'}</b>
                <span>{chapters.length ? (chapters.length === 1 ? 'chapter' : 'chapters') : 'paragraphs'}</span>
              </div>
            </div>
          </div>

          <Options {...props} onFollow={on => { setPref('follow', on); resumeFollow(); }} />

          <div className="actions">
            <button className="btn primary lg block" type="button" disabled={!data} title="Copies the transcript with a summary request in front"
              onClick={e => copyText(summaryPrompt(chapters.length > 0) + plainText(ctx()), 'Copied with a summary prompt. Paste it into Claude', e.currentTarget)}>
              <DoneSwap icon={SparkleIcon} />
              Copy for summary
            </button>
            <div className="row">
              <button className="btn" type="button" disabled={!data} onClick={e => copyText(plainText(ctx()), 'Transcript copied', e.currentTarget)}>
                <DoneSwap icon={CopyIcon} size={15} />
                Copy
              </button>
              <DownloadMenu label="Download" entries={downloads} onPick={download} disabled={!data} />
            </div>
          </div>

          {notes.notes.length > 0 && data && (
            <div className="card notes-card">
              <div className="card-head">
                <h3>Highlights <span className="count-badge">{notes.notes.length}</span></h3>
                <button className="btn ghost icon-only" type="button" title="Copy highlights & notes" aria-label="Copy highlights and notes"
                  onClick={e => copyText(notesMarkdown(notes.notes, data), 'Highlights copied', e.currentTarget)}>
                  <DoneSwap icon={CopyIcon} size={15} />
                </button>
              </div>
              <ul className="notes-list">
                {notes.notes.map(n => (
                  <li key={n.id}>
                    <button type="button" className="note-item" onClick={() => jumpToNote(n)}>
                      <div className="t">{fmtTime(n.start)}</div>
                      <div className="q">{n.quote}</div>
                      {n.note && <div className="n">{n.note}</div>}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </aside>

        <div className="main">
          <div className="reader-head">
            {fromBulk && (
              <button className="btn ghost back" type="button" onClick={onBack}>
                <BackIcon />
                Playlist
              </button>
            )}
            <label className="find">
              <SearchIcon />
              <input id="find" type="text" value={findInput} onChange={e => setFindInput(e.target.value)} onKeyDown={findKeys}
                placeholder="Find in transcript" autoComplete="off" aria-label="Find in transcript" />
              <span className="count">{findCount}</span>
            </label>
            <span className="note">{captionLine(props)}</span>
          </div>
          <Reader readerRef={readerRef} rows={rows} loading={!data} ts={prefs.ts} busy={busy} videoId={videoId}
            active={prefs.follow ? follow.active : -1} currentHit={shownHit} onSeek={onSeek} />
        </div>
      </main>

      <NotesPopover readerRef={readerRef} notes={notes} />
      <button className="follow-pill" type="button" hidden={!follow.lost}
        // Blur first: hiding a focused button makes Chromium cancel the smooth scroll back.
        onClick={e => { e.currentTarget.blur(); resumeFollow(); }}>
        <span className="dot" /> Back to now
      </button>
      <button className="undock" type="button" title="Close mini player" aria-label="Close mini player" hidden={!player.docked} onClick={player.dismiss}>
        <CloseIcon />
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
    <div className="card options">
      <Switch label="Timestamps" hint="Click one to jump the video there" checked={prefs.ts} onChange={on => setPref('ts', on)} aria="Show timestamps" />
      <Switch label="Follow along" hint="Highlight and scroll with the video" checked={prefs.follow} onChange={onFollow} aria="Follow along with the video" />
      <Switch label="Hide sound cues" hint="[Music], [Applause], ♪" checked={prefs.tags} onChange={on => setPref('tags', on)} aria="Hide sound cues" />
      <div className="opt">
        <div><div>Language</div><div className="hint">{source ? (source.isGenerated ? 'Auto-generated captions' : 'Captions by the creator') : ''}</div></div>
        <select className="select" aria-label="Transcript language" value={langValue} disabled={tracks.length < 2}
          onChange={e => {
            const [code, generated] = e.target.value.split('|');
            setLangPick(e.target.value);
            onLanguage(code, generated === '1');
          }}>
          {tracks.map(l => <option key={`${l.code}|${l.generated}`} value={`${l.code}|${l.generated ? 1 : 0}`}>{l.name}</option>)}
        </select>
      </div>
      <div className="opt">
        <div>
          <div>Translate</div>
          <div className="hint">
            {!source ? '' : !translations.length ? 'Not offered for this video' : data?.translation?.onDevice ? 'Translated on this device' : 'Via YouTube'}
          </div>
        </div>
        <select className="select" aria-label="Translate transcript" value={translatingTo ?? data?.translation?.code ?? ''}
          disabled={!translations.length || translatingTo != null} onChange={e => onTranslate(e.target.value)}>
          <option value="">Original</option>
          {translations.map(l => <option key={l.code} value={l.code}>{l.name}</option>)}
        </select>
      </div>
    </div>
  );
}

function Switch({ label, hint, checked, onChange, aria }: { label: string; hint: string; checked: boolean; onChange: (on: boolean) => void; aria: string }) {
  return (
    <div className="opt">
      <div><div>{label}</div><div className="hint">{hint}</div></div>
      <label className="switch">
        <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} aria-label={aria} />
        <span />
      </label>
    </div>
  );
}
