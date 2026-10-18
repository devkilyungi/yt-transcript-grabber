'use client';

import { type CSSProperties, type MouseEvent, type ReactNode, useEffect, useRef, useState } from 'react';
import { replayClass, store, toast } from '@/lib/browser';
import { thumbUrl } from '@/lib/links';
import { BookmarkIcon, LogoIcon } from './icons';

export type RecentEntry = { id: string; title: string; author: string };
export type ShownError = { message: string; detail?: string };

const MAX_RECENT = 8;

export function rememberRecent(entry: RecentEntry) {
  const list = store.get<RecentEntry[]>('tg.recent', []).filter(r => r.id !== entry.id);
  store.set('tg.recent', [entry, ...list].slice(0, MAX_RECENT));
}

export function Landing({ form, error, onOpen }: {
  /** The hero link box. */
  form: ReactNode;
  error: ShownError | null;
  onOpen: (id: string) => void;
}) {
  return (
    <main className="view">
      <div className="hero-wrap">
        <div className="hero">
          <h1>Any video, as <em>readable</em> text.</h1>
          <p className="lede">Paste a YouTube link and get a clean, paragraphed transcript, ready to read or drop into Claude for a summary.</p>
          {form}
          {error && (
            <div className="error-banner" role="alert">
              {error.message}
              {error.detail && <small>{error.detail}</small>}
            </div>
          )}
          <div className="chips">
            <span className="chip">youtube.com &amp; youtu.be</span>
            <span className="chip">Shorts &amp; live</span>
            <span className="chip">Playlists</span>
            <span className="chip">Paste several links at once</span>
          </div>
        </div>
      </div>
      <Recent onOpen={onOpen} />
      <Bookmarklet />
    </main>
  );
}

function Recent({ onOpen }: { onOpen: (id: string) => void }) {
  const [list, setList] = useState<RecentEntry[]>([]);
  useEffect(() => { setList(store.get('tg.recent', [])); }, []);
  if (!list.length) return null;

  const open = (e: MouseEvent, id: string) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey) return;
    e.preventDefault();
    onOpen(id);
  };

  return (
    <section className="section">
      <h3 className="section-title">Recent</h3>
      <div className="recent-grid">
        {list.map((r, i) => (
          <a key={r.id} className="recent-card" href={`/?v=${r.id}`} style={{ '--i': i } as CSSProperties} onClick={e => open(e, r.id)}>
            <div className="rc-img"><img src={thumbUrl(r.id)} alt="" loading="lazy" /></div>
            <div className="rc-body">
              <div className="rc-title">{r.title || r.id}</div>
              {r.author && <div className="rc-author">{r.author}</div>}
            </div>
          </a>
        ))}
      </div>
    </section>
  );
}

function Bookmarklet() {
  const ref = useRef<HTMLAnchorElement>(null);

  // React refuses to render javascript: URLs, and the origin is only known in the browser anyway.
  useEffect(() => {
    ref.current?.setAttribute('href', `javascript:(()=>{window.open('${location.origin}/?v='+encodeURIComponent(location.href))})()`);
  }, []);

  const click = (e: MouseEvent) => {
    e.preventDefault();
    replayClass(ref.current, 'nudge');
    toast('Drag this to your bookmarks bar');
  };

  return (
    <section className="section bookmarklet-tip">
      <div className="tip">
        <span className="tip-icon"><BookmarkIcon /></span>
        <div className="tip-text">
          <b>Open any YouTube video here in one click</b>
          <div>Drag this button to your bookmarks bar, then click it on any YouTube video or playlist page.</div>
        </div>
        <a ref={ref} className="btn bookmarklet" draggable title="Drag me to your bookmarks bar" onClick={click}>
          <LogoIcon size={14} />
          Get transcript
        </a>
      </div>
    </section>
  );
}
