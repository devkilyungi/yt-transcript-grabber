// The content security policy. The YouTube hosts are the only third parties: the player API, its iframe, and thumbnails.
export function cspFor(nonce: string, dev: boolean) {
  return [
    "default-src 'none'",
    `script-src 'self' 'nonce-${nonce}' https://www.youtube.com${dev ? " 'unsafe-eval'" : ''}`,
    `style-src 'self'${dev ? " 'unsafe-inline'" : ''}`, // the dev overlay injects styles; production has none inline
    "font-src 'self'",
    "img-src 'self' https://i.ytimg.com",
    `connect-src 'self'${dev ? ' ws://localhost:*' : ''}`,
    "frame-src https://www.youtube-nocookie.com https://www.youtube.com",
    "manifest-src 'self'",
    "base-uri 'none'",
    "form-action 'none'",
    "frame-ancestors 'none'",
  ].join('; ');
}
