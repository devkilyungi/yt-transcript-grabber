// Every text colour must reach WCAG AA (4.5:1) on every surface it can sit on, in both themes and every material.
// Non-text marks (accent fills, icons, focus rings) need 3:1. Run: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const css = await readFile(new URL('../public/css/tokens.css', import.meta.url), 'utf8');

const pairs = body => Object.fromEntries([...body.matchAll(/--([\w-]+):\s*light-dark\((#[0-9a-f]{6}),\s*(#[0-9a-f]{6})\)/gi)].map(([, k, l, d]) => [k, [l, d]]));
const base = pairs(css.match(/\/\* ---- the scale[\s\S]*?\n}/)[0]);
const materials = Object.fromEntries([...css.matchAll(/\[data-material='(\w+)'\] \{([\s\S]*?)\n\}/g)].map(([, name, body]) => [name, { ...base, ...pairs(body) }]));

const lum = hex => {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(c => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

const TEXT = ['ink', 'muted', 'faint', 'accent-text', 'good', 'warn', 'bad'];
const SURFACES = ['bg', 'surface', 'raised', 'well'];
const FILLS = [['on-accent', 'accent', 4.5], ['on-ink', 'ink', 4.5]];
// A card's line must show on the page and on its own fill. Fields are left out: in dark mode their line sits at ~1.1:1 on the well, so a field is told apart by its label and fill (see spec/08-quality.md, gaps).
const MARKS = [...SURFACES.map(s => ['accent', s, 3]), ['line', 'bg', 1.15], ['line', 'surface', 1.15], ['ink', 'mark', 4.5], ['muted', 'mark', 4.5]];

test('three materials are parsed', () => assert.deepEqual(Object.keys(materials).sort(), ['ditto', 'marker', 'steno']));

for (const [name, t] of Object.entries(materials)) {
  test(`${name}: text on surfaces, fills and marks`, () => {
    const fails = [];
    const check = (fg, bg, min) => [0, 1].forEach(i => {
      assert.ok(t[fg] && t[bg], `${name} is missing --${t[fg] ? bg : fg}`);
      const r = ratio(t[fg][i], t[bg][i]);
      if (r < min) fails.push(`${i ? 'dark' : 'light'} --${fg} on --${bg}: ${r.toFixed(2)} < ${min}`);
    });
    TEXT.forEach(fg => SURFACES.forEach(bg => check(fg, bg, 4.5)));
    FILLS.forEach(([fg, bg, min]) => check(fg, bg, min));
    MARKS.forEach(([fg, bg, min]) => check(fg, bg, min));
    assert.deepEqual(fails, []);
  });
}
