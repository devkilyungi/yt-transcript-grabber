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

## Desktop app (macOS)

The same app also comes as a Mac app, so you can open it from the Dock without keeping a dev server running. It's an Electron shell that starts the production server in the background and shows it in its own window.

```
npm run app:install
```

This builds the app and copies `Transcript Grabber.app` into `/Applications`. Open it from there, then right-click its Dock icon and choose Options → Keep in Dock. Run the command again after pulling or changing code, because the app bundles a snapshot of the build.

- `npm run app` builds the server and opens it in Electron without packaging, which is the quickest way to try a change.
- `npm run app:package` builds `dist/mac-arm64/Transcript Grabber.app` without installing it.
- `npm run app:icon` re-renders `build/icon.png` from `build/icon.svg`.

The app's server listens on `127.0.0.1:8766`, which is separate from the dev server's port, so both can run at once. It's only reachable from your own machine. The port is fixed because your notes, settings and recent videos are kept in the browser storage for that address. Closing the window keeps the app in the Dock, and quitting it stops the server. The server's log is at `~/Library/Logs/Transcript Grabber/server.log`.

The app is built on your machine and isn't code-signed, which is fine for running it yourself. To give it to someone else, it would need signing and notarising with an Apple Developer ID.

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
- A bookmarklet that opens the current YouTube page here (browser version only).
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
- On-device translation needs a browser with the Translator API, such as recent Chrome. The desktop app doesn't have it, so there translation relies on YouTube alone.

## Hosting it yourself

Run it locally. The app works out of the box on a home connection, but not on a normal cloud host. We tried Vercel: the site, chapters and playlists worked, but YouTube blocked almost every transcript request from Vercel's servers. YouTube does this to cloud IP ranges in general, so the same happens on any similar host.

If you want a hosted version, there are two ways around it. Neither is built in yet.

1. **Send the server's YouTube requests through a residential proxy.** Keep the app as it is, but route the requests in `lib/youtube/*` through a paid residential or rotating proxy, so YouTube sees home IPs instead of a data centre. It's the smallest code change, but it costs money and adds a third party that sees every request.
2. **Fetch transcripts in the visitor's browser.** Extend the bookmarklet so it fetches the transcript on the YouTube page itself, from the visitor's own IP and session, then hands it to the site to display. The server then only serves the page, chapters and playlists, so any static-friendly host works. The trade-off is an extra click on YouTube, and bulk mode and YouTube's own translation still go through the server. A browser extension could do the same without the extra click.

## Why not Rust?

The server could be written in Rust, for example with axum and a crate like rustypipe or yt-transcript-rs, but it isn't worth it. The server's work is a few HTTP requests and some XML parsing per video. The bottleneck is YouTube's rate limiting and bot detection, not CPU. The extraction code also breaks whenever YouTube changes something, and the maintained libraries that track those changes (youtubei.js, youtube-transcript-api, yt-dlp) are in JS and Python. Keeping one language across client and server also means the shared types in `lib/types.ts` cover both sides.

## Licence

[GNU AGPL-3.0](LICENSE), with one extra term in [NOTICE](NOTICE). You're free to use, change and host this project, but:

- **Credit it.** Any copy, fork or hosted version must show a visible "Based on Transcript Grabber by Victor Kilyungi" with a link back to this repo, both in the site itself and in its docs.
- **Share your changes.** If you run a modified version as a website, you must offer its users the full source code under the same licence. This is what the AGPL adds to the GPL: the plain GPL only applies when the software is handed out, so a site could change it and never publish the code.
