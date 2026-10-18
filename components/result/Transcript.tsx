'use client';

import { type CSSProperties, Fragment, memo, type MouseEvent, type RefObject } from 'react';
import type { Note, Paragraph } from '@/lib/types';
import { rangesIn } from '@/lib/notes';
import { fmtTime } from '@/lib/format';
import { watchUrl } from '@/lib/links';

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

const SKELETON_WIDTHS = [96, 88, 100, 72, 94, 100, 64, 90, 98, 80];

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
  return (
    <article ref={readerRef} className={`card reader${ts ? ' with-ts' : ''}${busy ? ' busy' : ''}`}>
      {loading ? (
        <div className="skeleton">
          {SKELETON_WIDTHS.map((w, i) => <div key={i} className="bar" style={{ width: `${w}%` } as CSSProperties} />)}
        </div>
      ) : rows.length ? rows.map((row, i) => (
        <Para key={i} row={row} ts={ts} videoId={videoId} active={i === active}
          currentHit={currentHit >= row.firstHit && currentHit < row.firstHit + row.hits ? currentHit : -1}
          onSeek={onSeek} />
      )) : (
        <p className="empty">This video’s captions are empty.</p>
      )}
    </article>
  );
}

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
    : <mark key={i} className={p.hit === currentHit ? 'f current' : 'f'}>{p.text}</mark>);

  return (
    <>
      {para.chapter && <div className="chapter"><h3>{para.chapter.title}</h3></div>}
      <div className={`para${active ? ' active' : ''}`} data-start={para.start}>
        {ts && (
          <a className="ts" href={watchUrl(videoId, para.start)} target="_blank" rel="noopener"
            onClick={e => onSeek(e, para.start)}>{fmtTime(para.start)}</a>
        )}
        <p>
          {row.segments.map((s, i) => s.note
            ? <mark key={i} className={s.note.note ? 'hl has-note' : 'hl'} data-note={s.note.id} title={s.note.note || undefined}>{pieces(s.pieces)}</mark>
            : <Fragment key={i}>{pieces(s.pieces)}</Fragment>)}
        </p>
      </div>
    </>
  );
});
