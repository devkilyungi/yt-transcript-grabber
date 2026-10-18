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

// Apply the saved theme before first paint to avoid a flash.
const themeScript = `try { const t = localStorage.getItem('tg.theme'); if (t) document.documentElement.dataset.theme = t; } catch {}`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    // The theme script sets data-theme before React hydrates.
    <html lang="en" className={`${sans.variable} ${serif.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
