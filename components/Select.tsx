'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { Icon } from './Sprite';

export type Option = { value: string; label: string; hint?: string; tone?: 'good' | 'warn' | 'bad' | 'none' };

type Props = Omit<React.ComponentProps<'button'>, 'value' | 'defaultValue' | 'onChange' | 'name' | 'children'> & {
  options: Option[];
  name?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (v: string) => void;
};

/**
 * The app's dropdown: a combobox button over a listbox in the top layer, so no scrolling or clipped parent can cut it off.
 * A hidden input carries `name` into forms. `tone` adds a status dot; `hint` a quiet note beside the label.
 */
export function Select({ options, name, value, defaultValue, onChange, ...button }: Props) {
  const [own, setOwn] = useState(defaultValue ?? options[0]?.value ?? '');
  const current = value ?? own;
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const btn = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const id = useId();
  const chosen = options.find((o) => o.value === current);
  const dots = options.some((o) => o.tone);

  const place = () => {
    const b = btn.current, l = list.current;
    if (!b || !l) return;
    const a = b.getBoundingClientRect(), h = l.offsetHeight; // 0 before it opens, so the first placement is below and onToggle flips it if needed
    l.style.minWidth = `${a.width}px`; // at least the field's width, wider when a label needs it so rows don't wrap
    l.style.left = `${Math.max(8, Math.min(a.left, innerWidth - l.offsetWidth - 8))}px`; // kept on screen once it has a width
    l.style.top = `${a.bottom + h + 14 > innerHeight && a.top > h + 14 ? a.top - h - 6 : a.bottom + 6}px`; // flips above when there's no room below
  };
  useEffect(() => {
    if (!open) return;
    const onMove = (e: Event) => { if (e.target !== list.current) place(); };
    addEventListener('scroll', onMove, { capture: true });
    addEventListener('resize', onMove);
    return () => { removeEventListener('scroll', onMove, { capture: true }); removeEventListener('resize', onMove); };
  }, [open]);
  useEffect(() => {
    const l = list.current, r = l?.children[active] as HTMLElement | undefined;
    if (l && r) l.scrollTop = Math.min(r.offsetTop, Math.max(l.scrollTop, r.offsetTop + r.offsetHeight - l.clientHeight)); // scrolls the list only, never the page
  }, [active, open]);
  const show = (on: boolean) => { if (on) list.current?.showPopover(); else if (list.current?.matches(':popover-open')) list.current.hidePopover(); };
  const pick = (i: number) => {
    const v = options[i].value;
    if (value === undefined) setOwn(v);
    if (v !== current) onChange?.(v);
    show(false);
    btn.current?.focus();
  };
  function onKey(e: React.KeyboardEvent) {
    const k = e.key, last = options.length - 1;
    if (!open) { if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(k)) { e.preventDefault(); show(true); } return; }
    let next = active;
    if (k === 'ArrowDown') next = Math.min(last, active + 1);
    else if (k === 'ArrowUp') next = Math.max(0, active - 1);
    else if (k === 'Home') next = 0;
    else if (k === 'End') next = last;
    else if (k === 'Enter' || k === ' ') { e.preventDefault(); return pick(active); }
    else if (k === 'Tab') return show(false);
    else if (k.length === 1) {
      const starts = (o: Option) => o.label.toLowerCase().startsWith(k.toLowerCase());
      const after = options.findIndex((o, i) => i > active && starts(o));
      next = after >= 0 ? after : Math.max(active, options.findIndex(starts));
    } else return;
    e.preventDefault();
    setActive(next);
  }

  return (
    <>
      {name && <input type="hidden" name={name} value={current} />}
      <button {...button} ref={btn} type="button" className="input select" role="combobox" aria-haspopup="listbox" aria-expanded={open} aria-controls={id}
        aria-activedescendant={open && active >= 0 ? `${id}-${active}` : undefined} popoverTarget={id} onKeyDown={onKey}>
        <span className="select-value" data-empty={!current || undefined}>{chosen?.label}</span>
        <Icon name="chev" />
      </button>
      <ul ref={list} id={id} className="select-list" role="listbox" popover="auto" tabIndex={-1}
        onBeforeToggle={(e) => { if (e.newState === 'open') { setActive(Math.max(0, options.findIndex((o) => o.value === current))); place(); } }}
        onToggle={(e) => { setOpen(e.newState === 'open'); if (e.newState === 'open') place(); }}>
        {options.map((o, i) => (
          <li key={o.value} id={`${id}-${i}`} role="option" aria-selected={o.value === current} data-active={i === active || undefined}
            onPointerMove={() => setActive(i)}
            // preventDefault stops the wrapping <label> passing the click on to the button, which would reopen the list.
            onClick={(e) => { e.preventDefault(); pick(i); }}>
            {dots && <i className="dot" data-tone={o.tone} />}
            <span data-empty={!o.value || undefined}>{o.label}</span>
            {o.hint && <small>{o.hint}</small>}
            <Icon name="check" />
          </li>
        ))}
      </ul>
    </>
  );
}
