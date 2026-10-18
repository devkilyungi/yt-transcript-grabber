'use client';

import { Fragment, type KeyboardEvent, useEffect, useRef, useState } from 'react';
import { closeMenus, flashDone, onCloseMenus } from '@/lib/browser';
import { DownloadIcon } from './icons';

export type MenuEntry =
  | { heading: string }
  | { divider: true }
  | { fmt: string; label: string; ext: string; disabled?: boolean };

/** A button that opens a menu of formats. Opening one menu closes any other. */
export function DownloadMenu({ label, entries, onPick, disabled = false, down = false }: {
  label: string;
  entries: MenuEntry[];
  onPick: (fmt: string) => void;
  disabled?: boolean;
  /** Open below the button instead of above it. */
  down?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => onCloseMenus(() => setOpen(false)), []);

  useEffect(() => {
    if (!open) return;
    menuRef.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus({ preventScroll: true });
    const outside = (e: MouseEvent) => { if (!wrapRef.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('click', outside);
    return () => document.removeEventListener('click', outside);
  }, [open]);

  const toggle = () => {
    if (open) return setOpen(false);
    closeMenus();
    setOpen(true);
  };

  const pick = (fmt: string) => {
    setOpen(false);
    onPick(fmt);
    flashDone(btnRef.current);
  };

  // Arrow keys move between items, like a native menu.
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const items = [...menuRef.current!.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')];
    const i = items.indexOf(document.activeElement as HTMLButtonElement);
    items[(i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]?.focus();
  };

  return (
    <div className="menu-wrap" ref={wrapRef}>
      <button ref={btnRef} className="btn" type="button" disabled={disabled} onClick={toggle}
        aria-haspopup="menu" aria-expanded={open}>
        <DownloadIcon />
        {label}
      </button>
      <div ref={menuRef} className={`menu${down ? ' down' : ''}${open ? ' open' : ''}`} role="menu" onKeyDown={onKeyDown}>
        {entries.map((entry, i) => (
          <Fragment key={i}>
            {'heading' in entry && <div className="menu-title">{entry.heading}</div>}
            {'divider' in entry && <hr />}
            {'fmt' in entry && (
              <button type="button" role="menuitem" disabled={entry.disabled} onClick={() => pick(entry.fmt)}>
                {entry.label} <small>.{entry.ext}</small>
              </button>
            )}
          </Fragment>
        ))}
      </div>
    </div>
  );
}
