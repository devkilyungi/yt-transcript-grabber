// Serves public/ locally with the same headers vercel.json sets in production, so the CSP is exercised in dev and e2e.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../public/', import.meta.url));
const { headers: rules } = JSON.parse(await readFile(new URL('../vercel.json', import.meta.url), 'utf8'));
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8' };
const port = Number(process.env.PORT) || 4173;

createServer(async (req, res) => {
  const path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  for (const rule of rules) {
    if (new RegExp(`^${rule.source}$`).test(path)) for (const { key, value } of rule.headers) res.setHeader(key, value);
  }
  try {
    const file = join(root, normalize(path === '/' ? 'index.html' : path));
    if (!file.startsWith(root)) throw new Error('outside public');
    const body = await readFile(file);
    res.writeHead(200, { 'Content-Type': types[extname(file)] ?? 'application/octet-stream' }).end(body);
  } catch {
    res.writeHead(404).end('Not found');
  }
}).listen(port, () => console.log(`House style at http://localhost:${port}`));
