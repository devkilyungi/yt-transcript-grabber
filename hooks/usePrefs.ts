'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Prefs } from '@/lib/types';
import { store } from '@/lib/browser';

const DEFAULTS: Prefs = { ts: true, tags: true, follow: true };

/** Reader preferences, remembered in this browser. */
export function usePrefs() {
  // The server can't see localStorage, so start from the defaults and load after hydration.
  const [prefs, setPrefs] = useState(DEFAULTS);
  useEffect(() => { setPrefs({ ...DEFAULTS, ...store.get('tg.prefs', {}) }); }, []);

  const setPref = useCallback(<K extends keyof Prefs>(key: K, value: Prefs[K]) => {
    setPrefs(p => {
      const next = { ...p, [key]: value };
      store.set('tg.prefs', next);
      return next;
    });
  }, []);

  return [prefs, setPref] as const;
}
