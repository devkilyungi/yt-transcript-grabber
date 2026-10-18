'use client';

import { type RefObject, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { EMBED_BLOCKED, loadYouTubeApi, type YTPlayer } from '@/lib/player';
import { toast } from '@/lib/browser';

const TICK_MS = 250;

/**
 * The embedded player for one video. Nothing loads until the first play or seek.
 * The frame floats ("docks") in the corner while the video plays and its slot is scrolled away.
 *
 * Attach `slotRef` to the 16:9 box that holds the poster, and `frameRef` to an empty element
 * inside it; YouTube puts its iframe there, so React must never render children into it.
 */
export function usePlayer(videoId: string, onTime: RefObject<(t: number) => void>) {
  const slotRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const [live, setLive] = useState(false);
  const [playing, setPlayingState] = useState(false);
  const [docked, setDocked] = useState(false);

  // Imperative state the YouTube callbacks read; React state above mirrors what renders.
  const r = useRef({
    player: null as YTPlayer | null, ready: false, timer: 0, playing: false,
    embeddable: true, slotVisible: true, dismissed: false, docked: false, videoId,
  });

  const updateDock = useCallback(() => {
    const s = r.current;
    s.docked = !!s.player && !s.slotVisible && !s.dismissed && (s.playing || s.docked);
    setDocked(s.docked);
  }, []);

  const setPlaying = useCallback((next: boolean) => {
    const s = r.current;
    if (next === s.playing) return;
    s.playing = next;
    clearInterval(s.timer);
    if (next) s.timer = window.setInterval(() => s.player && onTime.current(s.player.getCurrentTime()), TICK_MS);
    setPlayingState(next);
    updateDock();
  }, [onTime, updateDock]);

  const reset = useCallback(() => {
    const s = r.current;
    setPlaying(false);
    try { s.player?.destroy(); } catch {}
    Object.assign(s, { player: null, ready: false, dismissed: false, docked: false });
    frameRef.current?.replaceChildren();
    setLive(false);
    updateDock();
  }, [setPlaying, updateDock]);

  const start = useCallback(async (t: number) => {
    const s = r.current, id = s.videoId;
    let YT;
    try { YT = await loadYouTubeApi(); }
    catch (e) { toast((e as Error).message); return; }
    if (id !== s.videoId || s.player || !frameRef.current) return; // moved on meanwhile

    const mount = document.createElement('div');
    frameRef.current.replaceChildren(mount);
    setLive(true);
    s.player = new YT.Player(mount, {
      host: 'https://www.youtube-nocookie.com',
      videoId: id,
      playerVars: { autoplay: 1, start: Math.floor(t), playsinline: 1, rel: 0 },
      events: {
        onReady: e => { s.ready = true; e.target.seekTo(t, true); e.target.playVideo(); },
        onStateChange: e => setPlaying(e.data === YT.PlayerState.PLAYING),
        onError: e => {
          if (!EMBED_BLOCKED.has(e.data)) return;
          s.embeddable = false;
          reset();
          toast('This video can’t play here. Timestamps will open YouTube instead');
        },
      },
    });
  }, [reset, setPlaying]);

  // A new video starts from its poster; leaving it (or the page) stops playback.
  useEffect(() => {
    Object.assign(r.current, { videoId, embeddable: true });
    return reset;
  }, [videoId, reset]);

  useEffect(() => {
    const slot = slotRef.current;
    if (!slot) return;
    const io = new IntersectionObserver(([entry]) => {
      r.current.slotVisible = entry.isIntersecting;
      if (entry.isIntersecting) r.current.dismissed = false;
      updateDock();
    });
    io.observe(slot);
    return () => io.disconnect();
  }, [updateDock]);

  const controls = useMemo(() => ({
    /** Jump to `t` seconds and play. Returns false when the caller should open YouTube instead. */
    seek(t: number) {
      const s = r.current;
      if (!s.embeddable) return false;
      onTime.current(t);
      if (s.player && s.ready) { s.player.seekTo(t, true); s.player.playVideo(); }
      else if (!s.player) start(t);
      return true;
    },
    togglePlay() {
      const s = r.current;
      if (!s.player) return void start(0);
      if (!s.ready) return;
      if (s.playing) s.player.pauseVideo(); else s.player.playVideo();
    },
    /** Close the docked mini player. */
    dismiss() {
      r.current.player?.pauseVideo();
      r.current.dismissed = true;
      updateDock();
    },
  }), [onTime, start, updateDock]);

  return { slotRef, frameRef, live, playing, docked, ...controls };
}
