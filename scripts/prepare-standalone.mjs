// The standalone server leaves out static assets (they're meant for a CDN), so copy them in.
import { cpSync, existsSync } from 'node:fs';

const out = '.next/standalone';
if (!existsSync(`${out}/server.js`)) throw new Error('No standalone build; run `next build` first.');
cpSync('.next/static', `${out}/.next/static`, { recursive: true });
if (existsSync('public')) cpSync('public', `${out}/public`, { recursive: true });
console.log('Standalone server ready in', out);
