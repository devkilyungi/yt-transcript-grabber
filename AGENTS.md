<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Project rules

- The UI is built on a copied design kit. `public/css/tokens.css`, `house.css`, `public/js/gate.js` and `lib/house/` are kit files: change them only as logged in `CHANGELOG.md`. Project styles go in `public/css/app.css`.
- No inline styles or scripts in server-rendered HTML, because the CSP forbids them. Set per-element values through the CSSOM.
- Keep Electron's `appId`, `productName` and port 8766. Notes, highlights and recents live in localStorage for that origin, so changing any of them loses the user's data.
- Never open a browser or Electron on the real profile to test. `npm run test:e2e` uses a throwaway `--user-data-dir` and asserts it starts empty.
- After changing `tokens.css`, run `npm test`.
