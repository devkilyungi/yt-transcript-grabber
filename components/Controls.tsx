'use client';

import { useEffect, useRef, useState } from 'react';
import { copyText } from '@/lib/browser';
import { Icon } from './Sprite';

/** Copies, then swaps its label for a moment: the kit's two-state button. */
export function CopyButton({ label, getText, message, className = 'btn', disabled }: {
  label: string;
  getText: () => string;
  message: string;
  className?: string;
  disabled?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const timer = useRef(0);
  useEffect(() => () => clearTimeout(timer.current), []);
  const click = async () => {
    if (!(await copyText(getText(), message))) return;
    setCopied(true);
    clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopied(false), 1400);
  };
  return (
    <button className={className} type="button" disabled={disabled} onClick={click}>
      <span className="states">
        <span className={copied ? '' : 'on'}><Icon name="copy" />{label}</span>
        <span className={copied ? 'on' : ''}><Icon name="check" />Copied</span>
      </span>
    </button>
  );
}

export type Format = { fmt: string; label: string; disabled?: boolean };

/** A format picker and its Download button. */
export function Downloads({ formats, onPick, disabled, label = 'Download' }: {
  formats: Format[];
  onPick: (fmt: string) => void;
  disabled?: boolean;
  label?: string;
}) {
  const [fmt, setFmt] = useState(formats[0].fmt);
  return (
    <>
      <label className="select">
        <span className="sr">Download format</span>
        <select className="input" value={fmt} disabled={disabled} onChange={e => setFmt(e.target.value)}>
          {formats.map(f => <option key={f.fmt} value={f.fmt} disabled={f.disabled}>{f.label}</option>)}
        </select>
        <Icon name="chev" />
      </label>
      <button className="btn" type="button" disabled={disabled || formats.find(f => f.fmt === fmt)?.disabled} onClick={() => onPick(fmt)}><Icon name="down" />{label}</button>
    </>
  );
}

/** True once 300ms have passed, so a fast load never flashes a skeleton. */
export function useLate() {
  const [late, setLate] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setLate(true), 300);
    return () => clearTimeout(t);
  }, []);
  return late;
}
