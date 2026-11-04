'use client';

import { type ClipboardEvent, type FormEvent, type MouseEvent, useEffect, useRef } from 'react';
import { looksLikeLink } from '@/lib/links';
import { Icon } from './Sprite';
import type { ShownError } from './Landing';

/**
 * The link box, in its hero and bar sizes. Pasting a link into an empty box goes straight
 * there. `data-link-box` lets the D shortcut work while the box is empty.
 */
export function LinkForm({ value, onChange, onGo, busy, error, label = 'Video or playlist link', mini = false }: {
  value: string;
  onChange: (v: string) => void;
  onGo: (raw: string) => void;
  busy: boolean;
  error?: ShownError | null;
  label?: string;
  mini?: boolean;
}) {
  const submit = (e: FormEvent) => { e.preventDefault(); onGo(value); };
  const paste = (e: ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData('text');
    if (value.trim() || !looksLikeLink(text)) return;
    e.preventDefault();
    onChange(text.trim().replace(/\s+/g, ' '));
    onGo(text);
  };
  const input = { value, onPaste: paste, onChange: (e: { target: HTMLInputElement }) => onChange(e.target.value), type: 'text', inputMode: 'url' as const,
    autoComplete: 'off', spellCheck: false, 'data-link-box': '' };

  if (mini) {
    return (
      <form className="bar-form" onSubmit={submit} noValidate>
        <input {...input} className="input" aria-label="Another video or playlist link" placeholder="Paste another link…" />
        <button className="btn sm" type="submit" aria-busy={busy}>
          <span className="states"><span className={busy ? '' : 'on'}>Go</span><span className={busy ? 'on' : ''}><span className="spinner" aria-hidden="true" /></span></span>
        </button>
      </form>
    );
  }

  const bad = error?.field ? error : null;
  return (
    <form className="stack" onSubmit={submit} noValidate>
      <div className="field">
        <label htmlFor="url">{label}</label>
        <div className="grab">
          <input {...input} className="input" id="url" autoFocus placeholder="youtube.com/watch?v=…" aria-invalid={bad ? true : undefined} aria-describedby={bad ? 'url-err' : undefined} />
          <button className="btn primary lg go" type="submit" aria-busy={busy}>
            <span className="states">
              <span className={busy ? '' : 'on'}>Get transcript</span>
              <span className={busy ? 'on' : ''}><span className="spinner" aria-hidden="true" />Getting it</span>
            </span>
          </button>
        </div>
        {bad && <p className="field-error" id="url-err" role="alert"><Icon name="warn" />{bad.message} {bad.detail}</p>}
      </div>
    </form>
  );
}

let booted = false; // the kit's modules bind global listeners once; React's dev double-run must not repeat them

export function TopBar({ view, onHome, onPlaylist, mini }: {
  view: 'landing' | 'result' | 'bulk';
  onHome: () => void;
  onPlaylist: () => void;
  mini?: React.ReactNode;
}) {
  const theme = useRef<HTMLButtonElement>(null);

  // These modules touch the document as they load, so they can't be imported on the server.
  useEffect(() => {
    if (booted) return;
    booted = true;
    Promise.all([import('@/lib/house/theme.js'), import('@/lib/house/nav.js'), import('@/lib/house/splash.js')]).then(([t, n, s]) => {
      t.initTheme([theme.current!]);
      n.initNav();
      s.play();
    });
  }, []);

  const on = (fn: () => void) => (e: MouseEvent) => {
    if (e.metaKey || e.ctrlKey) return;
    e.preventDefault();
    fn();
  };

  return (
    <header className="bar">
      <div className="bar-in">
        <a className="brand" href="/" aria-label="Transcript Grabber, home" onClick={on(onHome)}>
          <svg className="brand-mark mk" viewBox="0 0 32 32" aria-hidden="true">
            <rect className="tile" width="32" height="32" rx="7" />
            <path className="hi" d="M7 16.5h18" />
            <path className="ln" d="M9 10.5h14" />
            <path className="ln" d="M9 16.5h14" />
            <path className="ln" d="M9 22.5h9" />
          </svg>
          <span>Transcript<b>.</b></span>
        </a>
        <nav className="links" id="menu" aria-label="Pages">
          <a href="/" aria-current={view === 'bulk' ? undefined : 'page'} onClick={on(onHome)}>Video</a>
          <a href="/?playlist" aria-current={view === 'bulk' ? 'page' : undefined} onClick={on(onPlaylist)}>Playlist</a>
          {mini}
          <div className="bar-tools">
            <button ref={theme} className="icon-btn theme-toggle" id="theme" type="button" aria-label="Switch theme (D)">
              <span className="glyph">
                <svg className="icon sun" aria-hidden="true"><use href="#i-sun" /></svg>
                <svg className="icon moon" aria-hidden="true"><use href="#i-moon" /></svg>
              </span>
              <span className="tool-label">Switch theme</span>
            </button>
          </div>
        </nav>
        <button className="icon-btn burger" id="burger" type="button" aria-label="Menu" aria-expanded="false" aria-controls="menu"><span><i /><i /><i /></span></button>
      </div>
    </header>
  );
}
