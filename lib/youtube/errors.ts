// What can go wrong talking to YouTube, and how each failure is reported to the client.

export type FailureKind =
  | 'blocked'          // rate-limited, or YouTube thinks we're a bot
  | 'age_restricted'
  | 'unavailable'      // private, removed or region-locked
  | 'unplayable'
  | 'disabled'         // the video has no captions
  | 'not_found'        // no captions in the requested language
  | 'not_translatable'
  | 'po_token'         // the captions need a proof-of-origin token we can't make
  | 'request_failed';

export class YouTubeError extends Error {
  constructor(readonly kind: FailureKind, detail = '') {
    super(detail || kind);
  }
}

/** An error with everything the client needs: an HTTP status, a sentence to show, and a code to act on. */
export class ApiError extends Error {
  constructor(readonly status: number, message: string, readonly code = '', readonly detail = '') {
    super(message);
  }
}

function toApiError(e: unknown): ApiError {
  if (e instanceof ApiError) return e;
  if (e instanceof YouTubeError) {
    switch (e.kind) {
      case 'disabled': return new ApiError(404, 'This video has captions turned off.');
      case 'not_found': return new ApiError(404, 'No transcript found in that language.');
      case 'unavailable': return new ApiError(404, 'That video is unavailable (private, removed or region-locked).');
      case 'not_translatable': return new ApiError(400, 'YouTube can’t translate this transcript into that language.');
      case 'blocked':
        return new ApiError(429, 'YouTube is temporarily blocking requests from this network. Wait a few minutes and try again.', 'blocked');
      case 'age_restricted': return new ApiError(502, 'This video is age-restricted, so YouTube won’t share its captions without a sign-in.', '', e.message);
      default: return new ApiError(502, 'YouTube refused the request.', '', e.message);
    }
  }
  // fetch() rejects with a TypeError when the network is down, and a TimeoutError when YouTube is slow.
  if (e instanceof Error && (e.name === 'TypeError' || e.name === 'TimeoutError')) {
    return new ApiError(502, 'Couldn’t reach YouTube. Check your connection and try again.', '', e.message);
  }
  return new ApiError(500, 'Something went wrong.', '', String(e).slice(0, 300));
}

const HEADERS = { 'Cache-Control': 'no-store' };

/** Run a route handler body and send its result, or its failure, as JSON. */
export async function respond(fn: () => Promise<unknown>): Promise<Response> {
  try {
    return Response.json(await fn(), { headers: HEADERS });
  } catch (e) {
    const err = toApiError(e);
    if (err.status >= 500) console.error('[api]', e);
    return Response.json({ error: err.message, code: err.code, detail: err.detail }, { status: err.status, headers: HEADERS });
  }
}
