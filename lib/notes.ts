// Highlights & notes: anchoring saved quotes in paragraph text, reading the selection, and export.
// Saved per video in this browser's localStorage under tg.notes.<videoId>.

import type { Note, Transcript } from './types';
import { fmtTime } from './format';
import { watchUrl } from './links';

export const MAX_QUOTE = 800;
export const notesKey = (videoId: string) => `tg.notes.${videoId}`;
export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

export type NoteRange = { s: number; e: number; note: Note };

/** Non-overlapping [s, e) ranges of saved highlights inside one paragraph's text. */
export function rangesIn(notes: Note[], paraStart: number, text: string): NoteRange[] {
  const out: NoteRange[] = [];
  for (const n of notes) {
    if (Math.abs(n.start - paraStart) > 0.01) continue;
    const s = text.startsWith(n.quote, n.offset) ? n.offset : text.indexOf(n.quote);
    if (s < 0) continue; // text changed (e.g. sound cues toggled); still listed in the sidebar
    out.push({ s, e: s + n.quote.length, note: n });
  }
  out.sort((a, b) => a.s - b.s);
  return out.filter((r, i) => i === 0 || r.s >= out[i - 1].e);
}

export type Anchor = { start: number; offset: number; quote: string };
export type SelectionTarget = { range: Range; anchor: Anchor | null }; // null: spans several paragraphs

/** Where the current selection sits inside `reader`, and its anchor if it's within one paragraph. */
export function selectionTarget(reader: HTMLElement): SelectionTarget | null {
  const sel = getSelection();
  if (!sel?.rangeCount || sel.isCollapsed) return null;
  const range = sel.getRangeAt(0);
  if (!reader.contains(range.commonAncestorContainer)) return null;
  const node = range.commonAncestorContainer;
  const p = (node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement)?.closest('.para p');
  if (!p) return { range, anchor: null };
  const raw = sel.toString();
  const quote = raw.trim().replace(/\s+/g, ' ');
  if (!quote) return null;
  const pre = document.createRange();
  pre.setStart(p, 0);
  pre.setEnd(range.startContainer, range.startOffset);
  const offset = pre.toString().length + (raw.length - raw.trimStart().length);
  const start = Number((p.parentElement as HTMLElement).dataset.start);
  return { range, anchor: { start, offset, quote: quote.slice(0, MAX_QUOTE) } };
}

export function notesMarkdown(notes: Note[], data: Transcript) {
  const items = notes.map(n => {
    const quote = n.quote.split('\n').map(l => `> ${l}`).join('\n');
    return `${quote}\n>\n> [${fmtTime(n.start)}](${watchUrl(data.videoId, n.start)})` + (n.note ? `\n\n${n.note}` : '');
  });
  return `# Highlights: ${data.title || data.videoId}\n\n${watchUrl(data.videoId)}\n\n${items.join('\n\n---\n\n')}\n`;
}
