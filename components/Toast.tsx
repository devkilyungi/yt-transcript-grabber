'use client';

import { useEffect, useState } from 'react';
import { onToast } from '@/lib/browser';

const SHOW_MS = 2000;

/** The one toast at the bottom of the page. Anything can raise it with `toast(msg)`. */
export function Toast() {
  const [msg, setMsg] = useState('');
  const [show, setShow] = useState(false);

  useEffect(() => {
    let timer = 0;
    const off = onToast(m => {
      setMsg(m);
      setShow(true);
      clearTimeout(timer);
      timer = window.setTimeout(() => setShow(false), SHOW_MS);
    });
    return () => { off(); clearTimeout(timer); };
  }, []);

  return <div className={`toast${show ? ' show' : ''}`} role="status" aria-live="polite">{msg}</div>;
}
