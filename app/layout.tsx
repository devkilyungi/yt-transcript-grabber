import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { Inter, Newsreader } from 'next/font/google';
import './globals.css';

const sans = Inter({ subsets: ['latin'], variable: '--font-sans', display: 'swap' });
const serif = Newsreader({ subsets: ['latin'], variable: '--font-serif', style: ['normal', 'italic'], axes: ['opsz'], display: 'swap' });

export const metadata: Metadata = {
  title: 'Transcript Grabber',
  description: 'Paste a YouTube link, get a clean, paragraphed transcript.',
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1 };

// Before first paint: apply the saved theme, and mark the desktop app (its preload defines `window.desktop`).
const headScript = `try { const t = localStorage.getItem('tg.theme'); if (t) document.documentElement.dataset.theme = t; } catch {}
if (window.desktop) document.documentElement.dataset.desktop = '';`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    // The head script sets data-theme and data-desktop before React hydrates.
    <html lang="en" className={`${sans.variable} ${serif.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: headScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
