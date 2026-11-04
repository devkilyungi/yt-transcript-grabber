import type { NextConfig } from 'next';

const config: NextConfig = {
  // A self-contained server in .next/standalone, which the desktop app bundles and runs.
  output: 'standalone',
  // A stray package-lock.json in the home folder would otherwise be taken as the workspace root,
  // which would also nest server.js deep inside .next/standalone.
  turbopack: { root: import.meta.dirname },
  outputFileTracingRoot: import.meta.dirname,
  // youtubei.js ships its own platform shims; let Node load it as-is instead of bundling it.
  serverExternalPackages: ['youtubei.js'],
  poweredByHeader: false,
  // The CSP is per request, in proxy.ts; everything that never changes is here.
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          // Not the kit's no-referrer: the YouTube embed refuses to play without an origin (error 153).
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
          { key: 'Cross-Origin-Resource-Policy', value: 'same-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), clipboard-read=(), clipboard-write=(self)' },
        ],
      },
      { source: '/fonts/:path*', headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }] },
    ];
  },
};

export default config;
