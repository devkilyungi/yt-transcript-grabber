'use client';

import { type MouseEvent, type ReactNode, useEffect, useRef, useState } from 'react';
import { store, toast } from '@/lib/browser';
import { thumbUrl } from '@/lib/links';
import type { Prefs } from '@/lib/types';
import { Icon } from './Sprite';

export type RecentEntry = { id: string; title: string; author: string };
export type ShownError = { message: string; detail?: string; /** The input is at fault, not the fetch: shown under the field. */ field?: boolean };

const MAX_RECENT = 8;
const SAMPLE = 'jNQXAC9IVRw'; // "Me at the zoo": 19 seconds, always up, has captions

export function rememberRecent(entry: RecentEntry) {
  const list = store.get<RecentEntry[]>('tg.recent', []).filter(r => r.id !== entry.id);
  store.set('tg.recent', [entry, ...list].slice(0, MAX_RECENT));
}

/** A failed fetch: what happened, in a banner above the form. */
export function ErrorNotice({ error }: { error: ShownError | null }) {
  if (!error || error.field) return null;
  return (
    <div className="unfold">
      <div className="notice" data-tone="bad" role="alert">
        <Icon name="warn" />
        <div><strong>{error.message}</strong>{error.detail && <p>{error.detail}</p>}</div>
      </div>
    </div>
  );
}

export function Landing({ form, error, prefs, setPref, onOpen }: {
  /** The hero link box. */
  form: ReactNode;
  error: ShownError | null;
  prefs: Prefs;
  setPref: <K extends keyof Prefs>(key: K, value: Prefs[K]) => void;
  onOpen: (id: string) => void;
}) {
  return (
    <section className="page-enter">
      <div className="hero">
        <h1>Read any video.</h1>
        <p className="lede">Paste a YouTube link and get its transcript in paragraphs, ready to read, search, highlight or hand to Claude for a summary.</p>
        <ErrorNotice error={error} />
        {form}
        <div className="grab-opts">
          <label className="switch"><span>Timestamps</span><input type="checkbox" role="switch" checked={prefs.ts} onChange={e => setPref('ts', e.target.checked)} /></label>
          <label className="switch"><span>Hide sound cues</span><input type="checkbox" role="switch" checked={prefs.tags} onChange={e => setPref('tags', e.target.checked)} /></label>
        </div>
      </div>
      <Recent onOpen={onOpen} />
      <Bookmarklet />
    </section>
  );
}

function Recent({ onOpen }: { onOpen: (id: string) => void }) {
  const [list, setList] = useState<RecentEntry[] | null>(null);
  useEffect(() => { setList(store.get('tg.recent', [])); }, []);
  if (!list) return null;

  if (!list.length) {
    return (
      <div className="empty">
        <Icon name="inbox" />
        <strong>Your recent videos</strong>
        <p>Videos you open appear here, so you can come back to them.</p>
        <button className="btn" type="button" onClick={() => onOpen(SAMPLE)}>Try a sample video</button>
      </div>
    );
  }

  const open = (e: MouseEvent, id: string) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey) return;
    e.preventDefault();
    onOpen(id);
  };
  const clear = () => {
    const saved = list;
    store.set('tg.recent', null);
    setList([]);
    toast('Recent videos cleared', { action: { label: 'Undo', run: () => { store.set('tg.recent', saved); setList(saved); } } });
  };

  return (
    <section className="stack" aria-labelledby="rec-h">
      <div className="card-head">
        <h2 id="rec-h">Recent videos</h2>
        <button className="btn ghost sm" type="button" onClick={clear}><Icon name="trash" />Clear</button>
      </div>
      <ul className="recents">
        {list.map(r => (
          <li key={r.id}>
            <a className="card recent" href={`/?v=${r.id}`} onClick={e => open(e, r.id)}>
              <img className="thumb" src={thumbUrl(r.id)} alt="" loading="lazy" />
              <span className="stack">
                <strong>{r.title || r.id}</strong>
                {r.author && <small>{r.author}</small>}
              </span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Bookmarklet() {
  const ref = useRef<HTMLAnchorElement>(null);

  // React refuses to render javascript: URLs, and the origin is only known in the browser anyway.
  useEffect(() => {
    ref.current?.setAttribute('href', `javascript:(()=>{window.open('${location.origin}/?v='+encodeURIComponent(location.href))})()`);
  }, []);

  return (
    <section className="card bookmarklet-tip">
      <div>
        <strong>Open any YouTube video here in one click</strong>
        <p className="muted">Drag this button to your bookmarks bar, then click it on any YouTube video or playlist page.</p>
      </div>
      <a ref={ref} className="btn" draggable onClick={e => { e.preventDefault(); toast('Drag this to your bookmarks bar'); }}>Get transcript</a>
    </section>
  );
}
