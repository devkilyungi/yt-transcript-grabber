# Transcript Grabber

Transcript Grabber is a local Next.js app. Paste a YouTube link and get a clean, paragraphed transcript, mainly so you can paste it into Claude for a summary. It runs on your own machine: no accounts, no API keys, and nothing is stored on a server.

## Getting started

Requires Node 20.9 or newer.

```
npm install
npm run dev
```

Then open http://localhost:8765.

For a production build, run `npm run build` and then `npm start` (same port). `npm run typecheck` runs the TypeScript compiler without emitting anything.

## Features

- Paragraphed transcript with clickable timestamps.
- Embedded player. Clicking a timestamp seeks the video, and the player docks to a mini player when you scroll away from it.
- Follow-along highlight that scrolls with the video. A "Back to now" pill appears when you scroll away.
- YouTube chapters shown as headings.
- Caption language picker and translation: YouTube auto-translate first, falling back to the browser's on-device Translator API when YouTube refuses.
- Find in transcript with Cmd/Ctrl+F; Enter and Shift+Enter step through matches.
- Highlights and notes on selected text, stored in localStorage per video and exportable as Markdown.
- "Copy for summary", which prepends a summary prompt to the transcript.
- Downloads as TXT, Markdown, SRT, WebVTT, JSON and CSV.
- Bulk mode for a playlist or several pasted links: a queue that runs two at a time, with pause, resume and retry, and combined copy and download.
- A bookmarklet that opens the current YouTube page here.
- Recent videos.
- Light and dark theme, toggled with the D key.

## URLs

- `/?v=<id or full link>` opens one video.
- `/?list=<playlist id>` opens a playlist in bulk mode.
- `/?videos=<id,id,...>` opens several videos in bulk mode.

## How it works

The browser never talks to YouTube for transcripts. The Next.js route handlers do.

- `/api/transcript` loads the watch page (handling the EU consent wall), reads the InnerTube API key, and asks the InnerTube player endpoint, as the ANDROID client, for the caption tracks. It picks a track, or adds `tlang` to the track URL for translation, and parses the timed-text XML into snippets.
- `/api/chapters` reads chapters from the watch page and caches them in memory.
- `/api/playlist` uses youtubei.js.

The client, `components/App.tsx`, is a single client component that switches between the landing, result and bulk views using the History API. Paragraphs and every export format are built client-side in `lib/transcript.ts`.

```
app/            layout, page, api/{transcript,chapters,playlist}
components/     App, TopBar, Landing, BulkView, DownloadMenu, Toast, icons
  result/       ResultView, Transcript, NotesPopover
hooks/          usePlayer, useFollowAlong, useNotes, usePrefs
lib/
  youtube/      server-side YouTube code
  transcript, links, format, bulk, notes, translate, player, browser, types
```

## API

| Request | Returns |
| --- | --- |
| `GET /api/transcript?url=&lang=&auto=1&tlang=` | Transcript JSON |
| `GET /api/chapters?id=` | `{ chapters }` |
| `GET /api/playlist?url=` | Playlist (title and videos) |

`url` accepts a full link or a bare id. `lang` picks a caption language, `auto=1` allows auto-generated captions, and `tlang` is the translation target.

Errors are returned as `{ error, code, detail }` with an HTTP status. `code` is set for failures the client acts on: `blocked` (429, YouTube is rate-limiting or bot-checking this network) and `translate_blocked` (429, translation is rate-limited, which triggers the on-device fallback). For other failures `code` is empty and `error` holds the message. Those cover captions off, no transcript in the requested language, an unavailable or age-restricted video, a language YouTube can't translate to, and network failures.

## Limitations

- It relies on YouTube's undocumented endpoints, which change without notice.
- YouTube rate-limits and bot-checks some networks (429, or "sign in to confirm you're not a bot"), especially VPNs and cloud hosts. This is why it is meant to run locally on a residential connection.
- Some caption tracks require PO tokens. These are detected and skipped.
- Playlists are capped at the first 200 videos.
- A video with no captions has no transcript.
- On-device translation needs a browser with the Translator API, such as recent Chrome.

## Why not Rust?

The server could be written in Rust, for example with axum and a crate like rustypipe or yt-transcript-rs, but it isn't worth it. The server's work is a few HTTP requests and some XML parsing per video. The bottleneck is YouTube's rate limiting and bot detection, not CPU. The extraction code also breaks whenever YouTube changes something, and the maintained libraries that track those changes (youtubei.js, youtube-transcript-api, yt-dlp) are in JS and Python. Keeping one language across client and server also means the shared types in `lib/types.ts` cover both sides.
