// Playlists, read through youtubei.js (YouTube's browse API pages through long lists in
// continuations, which that library already handles).

import { Innertube, Log, YTNodes } from 'youtubei.js';
import type { Playlist, PlaylistVideo } from '../types';
import { isVideoId } from '../links';
import { parseClock } from '../format';

const MAX_VIDEOS = 200;
const HIDDEN_TITLES = new Set(['[Private video]', '[Deleted video]']);

Log.setLevel(Log.Level.ERROR); // youtubei.js warns about every unparsed node otherwise

let client: Promise<Innertube> | null = null;
function innertube() {
  client ??= Innertube.create({ retrieve_player: false, generate_session_locally: true }).catch(e => {
    client = null;
    throw e;
  });
  return client;
}

export async function fetchPlaylist(listId: string): Promise<Playlist> {
  const yt = await innertube();
  let page = await yt.getPlaylist(listId);
  const { info } = page;

  const videos: PlaylistVideo[] = [];
  for (;;) {
    for (const item of page.items) {
      const video = toVideo(item);
      if (video && isVideoId(video.id) && !HIDDEN_TITLES.has(video.title)) videos.push(video);
    }
    if (videos.length >= MAX_VIDEOS || !page.has_continuation) break;
    page = await page.getContinuation();
  }

  return {
    id: listId,
    title: info.title || 'Playlist',
    author: info.author?.name || '',
    total: Number(String(info.total_items).replace(/\D/g, '')) || videos.length,
    videos: videos.slice(0, MAX_VIDEOS),
  };
}

// YouTube serves playlist rows in two layouts; read both.
function toVideo(item: YTNodes.PlaylistVideo | YTNodes.LockupView | YTNodes.ReelItem | YTNodes.ShortsLockupView): PlaylistVideo | null {
  if (item.is(YTNodes.PlaylistVideo)) {
    return { id: item.id, title: item.title.toString(), duration: item.duration?.seconds || null };
  }
  if (item.is(YTNodes.LockupView)) {
    if (item.content_type !== 'VIDEO') return null;
    const badge = item.content_image?.is(YTNodes.ThumbnailView)
      ? item.content_image.overlays.flatMap(o => (o.is(YTNodes.ThumbnailOverlayBadgeView) ? o.badges : [])).find(b => parseClock(b.text) != null)
      : undefined;
    return { id: item.content_id, title: item.metadata?.title.toString() || '', duration: badge ? parseClock(badge.text) : null };
  }
  return null;
}
