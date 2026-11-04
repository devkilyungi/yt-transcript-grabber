import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { Sprite } from '@/components/Sprite';

export const metadata: Metadata = {
  title: 'Transcript Grabber',
  description: 'Paste a YouTube link and get its transcript in paragraphs, ready to read, search, highlight or hand to Claude for a summary.',
  manifest: '/manifest.webmanifest',
  icons: { icon: '/favicon.svg', apple: '/icon-180.png' },
  appleWebApp: { title: 'Transcript', statusBarStyle: 'black-translucent' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f1e9db' },
    { media: '(prefers-color-scheme: dark)', color: '#16110c' },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    // gate.js sets data-theme, data-intro and data-desktop before React hydrates.
    <html lang="en" data-material="marker" data-splash="" suppressHydrationWarning>
      <head>
        <script src="/js/gate.js" />
        <link rel="preload" href="/fonts/atkinson-next-400.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        <link rel="preload" href="/fonts/atkinson-next-600.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        <link rel="preload" href="/fonts/courier-prime-700.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        <link rel="stylesheet" href="/css/tokens.css" />
        <link rel="stylesheet" href="/css/house.css" />
        <link rel="stylesheet" href="/css/app.css" />
      </head>
      <body>
        <Sprite />
        <div className="splash" id="splash" aria-hidden="true">
          <span className="door a" />
          <span className="door b" />
          <div className="splash-stage">
            <svg className="splash-mark mk" viewBox="0 0 32 32" aria-hidden="true">
              <rect className="tile" width="32" height="32" rx="7" />
              <path className="hi" d="M7 16.5h18" pathLength={1} />
              <path className="ln" d="M9 10.5h14" pathLength={1} />
              <path className="ln d1" d="M9 16.5h14" pathLength={1} />
              <path className="ln d2" d="M9 22.5h9" pathLength={1} />
            </svg>
            <span className="splash-word">Transcript Grabber</span>
          </div>
        </div>
        {children}
        <div className="toasts" id="toasts" role="region" aria-label="Notifications" />
        <div className="sr" id="live" aria-live="polite" />
      </body>
    </html>
  );
}
