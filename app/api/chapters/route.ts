// GET /api/chapters?id=   creator chapters, if any

import type { NextRequest } from 'next/server';
import { isVideoId } from '@/lib/links';
import { ApiError, respond } from '@/lib/youtube/errors';
import { chaptersFor } from '@/lib/youtube/chapters';

export function GET(req: NextRequest) {
  return respond(async () => {
    const id = req.nextUrl.searchParams.get('id') || '';
    if (!isVideoId(id)) throw new ApiError(400, 'Invalid video id.');
    try {
      return { chapters: await chaptersFor(id) };
    } catch {
      return { chapters: [], failed: true }; // chapters are a nicety; the transcript still shows, with a retry
    }
  });
}
