'use client';

import type { ClipboardEvent, FormEvent, MouseEvent, ReactNode } from 'react';
import { looksLikeLink } from '@/lib/links';
import { toggleTheme } from '@/lib/browser';
import { LinkIcon, LogoIcon, MoonIcon, SunIcon } from './icons';

/**
 * The link box, in its hero and top-bar sizes. Pasting a link into an empty box goes straight
 * there. `data-link-box` lets the D shortcut work while the box is empty.
 */
export function LinkForm({ value, onChange, onGo, busy, mini = false }: {
  value: string;
  onChange: (v: string) => void;
  onGo: (raw: string) => void;
  busy: boolean;
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

  return (
    <form className={mini ? 'composer small mini-search' : 'composer'} onSubmit={submit}>
      <LinkIcon size={mini ? 16 : 20} className="icon" />
      <input type="text" value={value} onChange={e => onChange(e.target.value)} onPaste={paste}
        placeholder={mini ? 'Paste another link or playlist…' : 'https://www.youtube.com/watch?v=…'}
        autoComplete="off" autoFocus={!mini} aria-label="YouTube link" data-link-box="" />
      {mini
        ? <button className={`btn primary${busy ? ' busy' : ''}`} type="submit">Go</button>
        : <button className={`btn primary lg${busy ? ' busy' : ''}`} type="submit"><span className="label">Get transcript</span> <span className="kbd">↵</span></button>}
    </form>
  );
}

export function TopBar({ onHome, children }: { onHome: () => void; children?: ReactNode }) {
  const home = (e: MouseEvent) => {
    if (e.metaKey || e.ctrlKey) return;
    e.preventDefault();
    onHome();
  };
  return (
    <header className="topbar">
      <a className="brand" href="/" onClick={home}>
        <span className="logo"><LogoIcon /></span>
        Transcript Grabber
      </a>
      {children}
      <span className="grow" />
      <span className="pill">Runs locally</span>
      <button className="theme-btn" type="button" onClick={toggleTheme} title="Switch theme (press D)" aria-label="Switch theme">
        <SunIcon />
        <MoonIcon />
        <kbd>D</kbd>
      </button>
    </header>
  );
}
