import { type NextRequest, NextResponse } from 'next/server';
import { cspFor } from '@/lib/csp';

// A fresh nonce per page. Next reads it from the request's CSP header and stamps its own inline scripts with it.
export function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const csp = cspFor(nonce, process.env.NODE_ENV === 'development');
  const headers = new Headers(request.headers);
  headers.set('x-nonce', nonce);
  headers.set('Content-Security-Policy', csp);
  const response = NextResponse.next({ request: { headers } });
  response.headers.set('Content-Security-Policy', csp);
  return response;
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|css/|js/|fonts/|favicon|icon|manifest).*)'],
};
