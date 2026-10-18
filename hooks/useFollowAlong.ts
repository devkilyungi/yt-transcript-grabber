'use client';

import { type RefObject, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { isTyping, scrollBehavior } from '@/lib/browser';

/** Last paragraph that starts at or before t. */
function indexAt(starts: number[], t: number) {
  let lo = 0, hi = starts.length - 1, ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (starts[mid] <= t + 0.25) { ans = mid; lo = mid + 1; } else hi = mid - 1;
  }
  return ans;
}

const SCROLL_KEYS = new Set(['PageUp', 'PageDown', 'ArrowUp', 'ArrowDown', 'Home', 'End', ' ']);

/**
 * While the video plays, the paragraph being spoken is highlighted and kept in view.
 * Scrolling yourself pauses that; `resume` ("Back to now") picks it up again.
 */
export function useFollowAlong({ readerRef, starts, enabled, live, playing }: {
  readerRef: RefObject<HTMLElement | null>;
  starts: number[];
  enabled: boolean;
  /** The player has been started at least once. */
  live: boolean;
  playing: boolean;
}) {
  const [active, setActive] = useState(-1);
  const [userScrolled, setUserScrolled] = useState(false);
  const r = useRef({ time: 0, active: -1, skipScroll: false, userScrolled: false, starts, on: false, playing });
  useLayoutEffect(() => { Object.assign(r.current, { starts, on: enabled && live, playing }); });

  const moveTo = useCallback((idx: number, scroll: boolean) => {
    if (idx === r.current.active) return;
    r.current.active = idx;
    r.current.skipScroll = !scroll;
    setActive(idx);
  }, []);

  const keepInView = useCallback(() => {
    const el = readerRef.current?.querySelectorAll('.para')[r.current.active];
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (rect.top < innerHeight * 0.15 || rect.bottom > innerHeight * 0.75) {
      el.scrollIntoView({ block: 'center', behavior: scrollBehavior() });
    }
  }, [readerRef]);

  /** Feed the player's current time in. */
  const onTime = useCallback((t: number) => {
    r.current.time = t;
    if (r.current.on) moveTo(indexAt(r.current.starts, t), true);
  }, [moveTo]);

  // Paragraphs re-flowed (an option changed) or follow-along was switched: re-place the
  // highlight without moving the page.
  useEffect(() => {
    moveTo(enabled && live ? indexAt(starts, r.current.time) : -1, false);
  }, [starts, enabled, live, moveTo]);

  useEffect(() => {
    if (r.current.skipScroll) { r.current.skipScroll = false; return; }
    if (active >= 0 && !r.current.userScrolled) keepInView();
  }, [active, keepInView]);

  /** The reader moved somewhere on purpose (scrolling, find, a note): stop chasing the video. */
  const pause = useCallback(() => {
    const s = r.current;
    if (!s.on || !s.playing || s.userScrolled) return;
    s.userScrolled = true;
    setUserScrolled(true);
  }, []);

  const resume = useCallback(() => {
    r.current.userScrolled = false;
    setUserScrolled(false);
    if (r.current.on) keepInView();
  }, [keepInView]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (!isTyping(e.target as Element) && SCROLL_KEYS.has(e.key)) pause(); };
    addEventListener('wheel', pause, { passive: true });
    addEventListener('touchmove', pause, { passive: true });
    addEventListener('keydown', onKey);
    return () => {
      removeEventListener('wheel', pause);
      removeEventListener('touchmove', pause);
      removeEventListener('keydown', onKey);
    };
  }, [pause]);

  return {
    active,
    /** Show "Back to now". */
    lost: userScrolled && enabled && playing,
    onTime, pause, resume,
  };
}
