// Creator chapters, read from the watch page: the player bar's chapter markers, else the
// description's chapter panel, else timestamps typed into the description itself.

import type { Chapter } from '../types';
import { parseClock } from '../format';
import { Session, fetchWatchPage, inlineJson, textOf } from './session';

const MAX_CACHED = 100;

// The transcript route already has the watch page in hand, so it files the chapters here and
// /api/chapters (which the client asks right after) answers without another request.
// Kept on globalThis so dev-mode reloads don't empty it.
const cache: Map<string, Promise<Chapter[]>> = ((globalThis as any).__tgChapters ??= new Map());

function remember(videoId: string, chapters: Promise<Chapter[]>) {
  cache.delete(videoId);
  cache.set(videoId, chapters);
  while (cache.size > MAX_CACHED) cache.delete(cache.keys().next().value!);
  // Failed lookups are retried next time.
  chapters.catch(() => { if (cache.get(videoId) === chapters) cache.delete(videoId); });
}

export function rememberChapters(videoId: string, html: string) {
  remember(videoId, Promise.resolve(chaptersFromHtml(html)));
}

export function chaptersFor(videoId: string): Promise<Chapter[]> {
  let chapters = cache.get(videoId);
  if (!chapters) {
    chapters = fetchWatchPage(new Session(), videoId).then(chaptersFromHtml);
    remember(videoId, chapters);
  }
  return chapters;
}

export function chaptersFromHtml(html: string): Chapter[] {
  const data = inlineJson(html, 'ytInitialData');
  const fromData = data && (markerChapters(data) || panelChapters(data));
  if (fromData?.length) return fromData;
  const description = inlineJson(html, 'ytInitialPlayerResponse')?.videoDetails?.shortDescription;
  return typeof description === 'string' ? descriptionChapters(description) : [];
}

/** Depth-first search for the first value under `key` that `accept` likes. */
function find(node: any, key: string, accept: (v: any) => boolean = () => true): any {
  if (!node || typeof node !== 'object') return undefined;
  if (key in node && accept(node[key])) return node[key];
  for (const v of Object.values(node)) {
    const hit = find(v, key, accept);
    if (hit !== undefined) return hit;
  }
  return undefined;
}

function markerChapters(data: any): Chapter[] | null {
  const markers: any[] = find(data, 'markersMap', Array.isArray) || [];
  const entry = markers.find(m => m.key === 'DESCRIPTION_CHAPTERS') || markers.find(m => m.value?.chapters?.length);
  const chapters = entry?.value?.chapters?.map((c: any) => ({
    start: Number(c.chapterRenderer?.timeRangeStartMillis) / 1000,
    title: textOf(c.chapterRenderer?.title).trim(),
  }));
  return chapters ? valid(chapters) : null;
}

function panelChapters(data: any): Chapter[] | null {
  const panel = (data.engagementPanels || []).find((p: any) =>
    String(p.engagementPanelSectionListRenderer?.panelIdentifier).includes('description-chapters'));
  const items: any[] | undefined = find(panel, 'contents', Array.isArray);
  const chapters = items?.map(i => i.macroMarkersListItemRenderer).filter(Boolean).map((r: any) => ({
    start: parseClock(textOf(r.timeDescription)) ?? NaN,
    title: textOf(r.title).trim(),
  }));
  return chapters ? valid(chapters) : null;
}

/** "0:00 Intro" lines, the same convention YouTube itself uses to make chapters. */
function descriptionChapters(description: string): Chapter[] {
  const chapters = description.split('\n').flatMap(line => {
    const m = line.match(/^\s*[[(]?((?:\d{1,2}:)?\d{1,2}:\d{2})[\])]?\s*[-–—:|·•]?\s*(.+?)\s*$/);
    const start = m && parseClock(m[1]);
    return start != null ? [{ start, title: m![2] }] : [];
  });
  return chapters.length >= 2 && chapters[0].start === 0 ? valid(chapters) : [];
}

/** Titled chapters in strictly increasing order, or nothing. */
function valid(chapters: Chapter[]): Chapter[] {
  const ok = chapters.every((c, i) => Number.isFinite(c.start) && c.title && (i === 0 || c.start > chapters[i - 1].start));
  return ok ? chapters : [];
}
