// GET /api/transcript?url=&lang=&auto=1&tlang=   captions as timed snippets

import type { NextRequest } from 'next/server';
import { videoIdFrom } from '@/lib/links';
import { ApiError, respond } from '@/lib/youtube/errors';
import { fetchTranscript } from '@/lib/youtube/transcript';

// BCP 47 shaped: YouTube's codes are like en, zh-Hans, or a.en for auto tracks.
const LANGUAGE = /^[A-Za-z0-9.-]{1,35}$/;

export function GET(req: NextRequest) {
  return respond(async () => {
    const q = req.nextUrl.searchParams;
    const videoId = videoIdFrom(q.get('url') || '');
    if (!videoId) throw new ApiError(400, 'That doesn’t look like a YouTube link.');
    const lang = q.get('lang'), tlang = q.get('tlang');
    if ((lang && !LANGUAGE.test(lang)) || (tlang && !LANGUAGE.test(tlang))) throw new ApiError(400, 'That language code isn’t valid.');
    return fetchTranscript(videoId, { lang, auto: q.get('auto') === '1', tlang });
  });
}
