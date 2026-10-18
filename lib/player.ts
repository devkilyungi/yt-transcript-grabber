// The YouTube IFrame API. It only loads the first time someone presses play or clicks a
// timestamp, so reading a transcript never pulls in YouTube's player on its own.

export type YTPlayer = {
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  playVideo(): void;
  pauseVideo(): void;
  getCurrentTime(): number;
  destroy(): void;
};

type YTEvent = { target: YTPlayer; data: number };

export type YTNamespace = {
  Player: new (el: HTMLElement, options: {
    host?: string;
    videoId: string;
    playerVars?: Record<string, number>;
    events?: { onReady?(e: YTEvent): void; onStateChange?(e: YTEvent): void; onError?(e: YTEvent): void };
  }) => YTPlayer;
  PlayerState: { PLAYING: number };
};

declare global {
  interface Window { YT?: YTNamespace; onYouTubeIframeAPIReady?: () => void }
}

/** Error codes for "the owner doesn't allow embedding". */
export const EMBED_BLOCKED = new Set([101, 150, 153]);

let apiReady: Promise<YTNamespace> | null = null;

export function loadYouTubeApi() {
  apiReady ??= new Promise((resolve, reject) => {
    if (window.YT?.Player) return resolve(window.YT);
    window.onYouTubeIframeAPIReady = () => resolve(window.YT!);
    const s = document.createElement('script');
    s.src = 'https://www.youtube.com/iframe_api';
    s.onerror = () => { apiReady = null; reject(new Error('Could not load the YouTube player')); };
    document.head.append(s);
  });
  return apiReady;
}
