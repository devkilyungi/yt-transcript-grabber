// GET /api/transcript?url=&lang=&auto=1&tlang=   captions as timed snippets

import type { NextRequest } from 'next/server';
import { videoIdFrom } from '@/lib/links';
import { ApiError, respond } from '@/lib/youtube/errors';
import { fetchTranscript } from '@/lib/youtube/transcript';

export function GET(req: NextRequest) {
  return respond(async () => {
    const q = req.nextUrl.searchParams;
    const videoId = videoIdFrom(q.get('url') || '');
    if (!videoId) throw new ApiError(400, 'That doesn’t look like a YouTube link.');
    return fetchTranscript(videoId, { lang: q.get('lang'), auto: q.get('auto') === '1', tlang: q.get('tlang') });
  });
}
