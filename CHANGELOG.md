# Changelog

## 3.0.0

Rebuilt on the house design system, as a desktop app.

### Added

- Marker material with a dotted page, a brown and beige palette, the splash, a new mark, app icons and a manifest.
- Security headers and a per-request nonce CSP in `proxy.ts`.
- A playlist page reachable before anything is queued (`/?playlist`).
- An error boundary, a skip link, focus moved to the main content on view change, and print and forced-colours styles.
- A failed chapter fetch now says so instead of looking like a video without chapters.
- Contrast and link-parsing tests, a browser test on a throwaway profile, and CI.

### Changed

- The desktop app is now the main way to run this. Vercel is gone.
- The download menu became a format select with a Download button.
- Node 22.18 or newer is required.

### Kept

- Notes, highlights and recents, because the app's id, name and port are unchanged. The old `tg.theme` setting migrates to the kit's `house` key.

## Decision log

- **Next.js in Electron, not the kit's static delivery or Vercel.** YouTube blocks transcript requests from cloud hosts, and the app already had a working shell.
- **Marker with Ditto's dots instead of square ruling.** The owner's choice after seeing the concept.
- **Accent hue near 25°.** The spec asks for 40° or more from other projects' accents, and this sits close to iron, brass and `--warn`. Kept because the owner asked for brown. It is one token block if that changes.
- **`Referrer-Policy: strict-origin-when-cross-origin`, not `no-referrer`.** The YouTube embed fails with error 153 when it gets no referrer.
- **The CSP allows YouTube's player and thumbnails.** The spec says no embedded widgets, but the player is the product. The footer says videos play from youtube-nocookie.com.
- **Nonce CSP from `proxy.ts`.** The spec's choice for Next apps. The headers live there rather than in `vercel.json`, so they work in the desktop app too.
- **No language select before fetching.** The languages a video offers aren't known until it's fetched, so the select lives on the result.
- **No service worker.** A transcript needs the network, and the app's shell is local already.

## Beyond the spec, to fold back into the kit

- `--mark` token for highlights.
- `data-link-box` exception in `lib/house/theme.js`, so the D key still toggles the theme while the autofocused link box is empty.
- The kit's native `.select` wrapper rules are gone from `house.css`: every dropdown is now `components/Select.tsx`, a combobox over a top-layer listbox, styled in `app.css`.
- Theme-swap circle in `lib/house/theme.js` given in percentages, not px. Chromium 152's composited clip-path reads px on `::view-transition-new/old(root)` as device pixels, so on a 2× screen the circle grew from halfway to the toggle. The site would hit the same bug in that Chromium.
- `.skip` link styles, which the kit doesn't have, and focus moved to `#main` on view change.
- Forced-colours rules for the switch, check box, meter and text marks, and print styles for a transcript.
- A storage migration path in `gate.js`.
- Select plus button as a pattern for choosing a download format.
- A sample video link on an empty landing page.
- A way to deliver headers without `vercel.json`, which is the only route the spec describes in full.
- `.bar-form`, `.switch small`, `.options`, `.note-quote`.

## Known gaps

- ESLint isn't installed, so CI doesn't lint.
- CI runs neither the build nor the browser test.
- VoiceOver and Lighthouse runs haven't been done.
- The 320px check covers the landing page only.
- The kit hides a placeholder on focus, so the autofocused landing box shows none.
