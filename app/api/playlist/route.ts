// GET /api/playlist?url=   the videos in a playlist (link or bare id)

import type { NextRequest } from 'next/server';
import { playlistIdFrom } from '@/lib/links';
import { ApiError, respond } from '@/lib/youtube/errors';
import { fetchPlaylist } from '@/lib/youtube/playlist';

export function GET(req: NextRequest) {
  return respond(async () => {
    const listId = playlistIdFrom(req.nextUrl.searchParams.get('url') || '', { bare: true });
    if (!listId) throw new ApiError(400, 'That doesn’t look like a YouTube playlist link.');
    try {
      return await fetchPlaylist(listId);
    } catch (e) {
      throw new ApiError(404, 'Couldn’t open that playlist. It may be private or empty.', '', String(e).slice(0, 200));
    }
  });
}
