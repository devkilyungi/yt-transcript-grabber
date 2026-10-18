// Bulk mode: a playlist, or several pasted links, fetched as a gentle queue.
// Two requests at a time with a short, randomised gap, so YouTube doesn't start refusing us.
// If it does, the queue pauses itself and resumes after a random wait that grows with each
// refusal in a row, giving up and leaving it to the user after a few.
//
// The queue lives outside React so it keeps running while a finished video is open in the
// reader. Components subscribe to it with useSyncExternalStore.

import type { Playlist, Transcript } from './types';
import { api, ApiError } from './browser';
import { plural, wordCount } from './format';

const CONCURRENCY = 2;
const GAP_MS = [400, 1200];
/** First wait after YouTube refuses us; it doubles with each refusal in a row. */
const BACKOFF_MS = [15_000, 30_000];
const BACKOFF_CAP_MS = 5 * 60_000;
/** Refusals in a row before the queue stops resuming itself. */
const MAX_AUTO_RESUMES = 5;
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
const between = ([lo, hi]: number[]) => lo + Math.random() * (hi - lo);

export type BulkSource = { list: string; url?: string } | { ids: string[] };
export type BulkItemState = 'queued' | 'loading' | 'done' | 'error';
export type BulkItem = {
  id: string;
  title?: string;
  duration?: number | null;
  state: BulkItemState;
  data?: Transcript;
  words?: number;
  error?: string;
};

export const keyOf = (source: BulkSource) => ('list' in source ? `list:${source.list}` : `ids:${source.ids.join(',')}`);

export function createBulkQueue() {
  const listeners = new Set<() => void>();
  let version = 0;
  const emit = () => { version++; listeners.forEach(fn => fn()); };

  const s = {
    items: [] as BulkItem[],
    key: '',
    eyebrow: 'Playlist',
    title: '',
    sub: '',
    paused: false,
    /** YouTube refused us and the queue paused itself. */
    blocked: false,
    /** When the queue will resume itself after being blocked, or 0 if it won't. */
    resumeAt: 0,
  };
  let gen = 0, running = 0, strikes = 0;
  let resumeTimer: ReturnType<typeof setTimeout> | undefined;
  let tickTimer: ReturnType<typeof setInterval> | undefined;

  function clearAutoResume() {
    clearTimeout(resumeTimer);
    clearInterval(tickTimer);
    s.resumeAt = 0;
  }

  /** Resume after a random, growing wait; past the limit, leave it to the user. */
  function scheduleAutoResume() {
    if (s.resumeAt) return; // both workers can be refused at once
    strikes++;
    if (strikes > MAX_AUTO_RESUMES) return;
    const wait = Math.min(between(BACKOFF_MS) * 2 ** (strikes - 1), BACKOFF_CAP_MS);
    s.resumeAt = Date.now() + wait;
    resumeTimer = setTimeout(() => {
      clearAutoResume();
      s.paused = false;
      s.blocked = false;
      run();
    }, wait);
    tickTimer = setInterval(emit, 1000); // keeps the countdown current
  }

  async function worker(g: number) {
    while (g === gen && !s.paused) {
      const item = s.items.find(i => i.state === 'queued');
      if (!item) break;
      item.state = 'loading';
      emit();
      try {
        item.data = await api<Transcript>('/api/transcript', { url: item.id });
        if (g !== gen) return;
        item.words = wordCount(item.data.snippets.map(sn => sn.text).join(' '));
        item.state = 'done';
        strikes = 0;
      } catch (e) {
        if (g !== gen) return;
        if (e instanceof ApiError && e.code === 'blocked') {
          // YouTube is refusing requests from this network. Put it back and stop.
          item.state = 'queued';
          s.paused = true;
          s.blocked = true;
          scheduleAutoResume();
        } else {
          item.state = 'error';
          item.error = (e as Error).message;
        }
      }
      emit();
      await sleep(between(GAP_MS));
    }
  }

  async function run() {
    const g = gen;
    if (s.paused) return emit();
    const slots = CONCURRENCY - running;
    if (slots <= 0) return;
    await Promise.all(Array.from({ length: slots }, async (_, i) => {
      await sleep(i * between(GAP_MS));
      running++;
      try { await worker(g); } finally { if (g === gen) running--; }
    }));
    if (g === gen) emit();
  }

  const queue = {
    subscribe(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn); }; },
    getVersion: () => version,
    get state(): Readonly<typeof s> { return s; },
    get key() { return s.key; },

    /** Start a new batch. Throws (ApiError) if the playlist itself can't be read. */
    async start(source: BulkSource) {
      const g = ++gen;
      running = 0;
      strikes = 0;
      clearAutoResume();
      Object.assign(s, { items: [], key: keyOf(source), paused: false, blocked: false, sub: '' });

      let videos: { id: string; title?: string; duration?: number | null }[];
      if ('list' in source) {
        Object.assign(s, { eyebrow: 'Playlist', title: 'Reading playlist…' });
        emit();
        const pl = await api<Playlist>('/api/playlist', { url: source.url || `https://www.youtube.com/playlist?list=${source.list}` });
        if (g !== gen) return;
        const shown = pl.total > pl.videos.length ? ` · showing the first ${pl.videos.length}` : '';
        Object.assign(s, { title: pl.title, sub: [pl.author, plural(pl.total, 'video') + shown].filter(Boolean).join(' · ') });
        videos = pl.videos;
      } else {
        Object.assign(s, { eyebrow: 'Several videos', title: plural(source.ids.length, 'video'), sub: 'From the links you pasted' });
        videos = source.ids.map(id => ({ id }));
      }
      document.title = `${s.title} · Transcript Grabber`;
      s.items = videos.map(v => ({ id: v.id, title: v.title, duration: v.duration, state: 'queued' }));
      emit();
      run();
    },

    /** Stop fetching (the user left bulk mode). Finished transcripts are dropped too. */
    cancel() {
      gen++;
      running = 0;
      clearAutoResume();
      Object.assign(s, { items: [], key: '' });
      emit();
    },

    retry(which: BulkItem[]) {
      for (const item of which) { item.state = 'queued'; item.error = ''; }
      clearAutoResume();
      s.paused = false;
      s.blocked = false;
      emit();
      run();
    },

    togglePause() {
      clearAutoResume();
      s.paused = !s.paused;
      s.blocked = false;
      if (s.paused) emit(); else run();
    },
  };
  return queue;
}

export type BulkQueue = ReturnType<typeof createBulkQueue>;
