'use client';

import { Fragment, memo, type MouseEvent, type RefObject } from 'react';
import type { Note, Paragraph } from '@/lib/types';
import { rangesIn } from '@/lib/notes';
import { fmtTime } from '@/lib/format';
import { watchUrl } from '@/lib/links';
import { useLate } from '../Controls';
import { Icon } from '../Sprite';

/* ---------- Layout: paragraphs split into highlight and find-match pieces ---------- */

/** A run of text; `hit` is its find-match number across the whole transcript, or -1. */
type Piece = { text: string; hit: number };
/** Text inside one saved highlight (`note`), or between highlights (`note: null`). */
type Segment = { note: Note | null; pieces: Piece[] };
export type Row = { para: Paragraph; segments: Segment[]; firstHit: number; hits: number };

function findPieces(text: string, query: string, counter: { n: number }): Piece[] {
  if (!query) return text ? [{ text, hit: -1 }] : [];
  const out: Piece[] = [], lower = text.toLowerCase();
  let at = 0, i;
  while ((i = lower.indexOf(query, at)) !== -1) {
    if (i > at) out.push({ text: text.slice(at, i), hit: -1 });
    out.push({ text: text.slice(i, i + query.length), hit: counter.n++ });
    at = i + query.length;
  }
  if (at < text.length) out.push({ text: text.slice(at), hit: -1 });
  return out;
}

/** Split every paragraph at its highlights, then at find matches, numbering the matches in order. */
export function layoutRows(paras: Paragraph[], notes: Note[], query: string) {
  const counter = { n: 0 };
  const rows: Row[] = paras.map(para => {
    const firstHit = counter.n;
    const segments: Segment[] = [];
    let at = 0;
    for (const r of rangesIn(notes, para.start, para.text)) {
      if (r.s > at) segments.push({ note: null, pieces: findPieces(para.text.slice(at, r.s), query, counter) });
      segments.push({ note: r.note, pieces: findPieces(para.text.slice(r.s, r.e), query, counter) });
      at = r.e;
    }
    segments.push({ note: null, pieces: findPieces(para.text.slice(at), query, counter) });
    return { para, segments, firstHit, hits: counter.n - firstHit };
  });
  return { rows, hits: counter.n };
}

/* ---------- Rendering ---------- */

export function Transcript({ readerRef, rows, loading, ts, busy, videoId, active, currentHit, onSeek }: {
  readerRef: RefObject<HTMLElement | null>;
  rows: Row[];
  loading: boolean;
  ts: boolean;
  busy: boolean;
  videoId: string;
  /** Paragraph being spoken (follow-along), or -1. */
  active: number;
  /** Find match being shown, or -1. */
  currentHit: number;
  onSeek: (e: MouseEvent<HTMLAnchorElement>, t: number) => void;
}) {
  const late = useLate();
  return (
    <article ref={readerRef} className="reader" aria-busy={busy || loading}>
      {loading ? (
        <div className="skeleton" hidden={!late}><i /><i /><i /><i /><i /><i /><i /></div>
      ) : rows.length ? rows.map((row, i) => (
        <Para key={i} row={row} ts={ts} videoId={videoId} active={i === active}
          currentHit={currentHit >= row.firstHit && currentHit < row.firstHit + row.hits ? currentHit : -1}
          onSeek={onSeek} />
      )) : (
        <div className="empty">
          <Icon name="inbox" />
          <strong>This video’s captions are empty</strong>
          <p>YouTube has the track but nothing in it. Try another language from the list, if there is one.</p>
        </div>
      )}
    </article>
  );
}

const FRESH_MS = 1000; // a highlight made this recently swipes on

/** One paragraph. Memoized, so follow-along and find only re-render the rows that change. */
const Para = memo(function Para({ row, ts, videoId, active, currentHit, onSeek }: {
  row: Row;
  ts: boolean;
  videoId: string;
  active: boolean;
  currentHit: number;
  onSeek: (e: MouseEvent<HTMLAnchorElement>, t: number) => void;
}) {
  const { para } = row;
  const pieces = (list: Piece[]) => list.map((p, i) => p.hit < 0
    ? <Fragment key={i}>{p.text}</Fragment>
    : <mark key={i} className={p.hit === currentHit ? 'find current' : 'find'}>{p.text}</mark>);
  const markClass = (n: Note) => ['hl', n.note && 'has-note', Date.now() - n.at < FRESH_MS && 'fresh'].filter(Boolean).join(' ');

  return (
    <>
      {para.chapter && <h2>{para.chapter.title}</h2>}
      <div className={active ? 'para now' : 'para'} aria-current={active ? 'true' : undefined} data-start={para.start}>
        {ts && (
          <a className="t" href={watchUrl(videoId, para.start)} target="_blank" rel="noreferrer" aria-label={`Play from ${fmtTime(para.start)}`}
            onClick={e => onSeek(e, para.start)}>{fmtTime(para.start)}</a>
        )}
        <p>
          {row.segments.map((s, i) => s.note
            ? <mark key={i} className={markClass(s.note)} data-note={s.note.id} title={s.note.note || undefined}>{pieces(s.pieces)}</mark>
            : <Fragment key={i}>{pieces(s.pieces)}</Fragment>)}
        </p>
      </div>
    </>
  );
});
