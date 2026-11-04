// Drives the real Electron shell against the built server: run `npm run build:server` first.
// The online part needs network and YouTube; set E2E_OFFLINE=1 to skip it. Screenshots go to E2E_SHOTS if set.
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { _electron as electron } from 'playwright-core';

const ORIGIN = 'http://127.0.0.1:8766';
const shots = process.env.E2E_SHOTS;
const shot = async (page, name) => { if (shots) await page.screenshot({ path: join(shots, `${name}.png`) }); };
const passed = [];
const check = async (name, fn) => { await fn(); passed.push(name); console.log(`ok - ${name}`); };

// A throwaway profile: the app's normal one holds the person's own notes and recents.
const profile = mkdtempSync(join(tmpdir(), 'tg-e2e-'));
const app = await electron.launch({ args: ['electron', `--user-data-dir=${profile}`] });
let failed = false;
try {
  const page = await app.firstWindow();
  const problems = [];
  page.on('console', m => { if (m.type() === 'error') problems.push(`console: ${m.text()}`); });
  page.on('pageerror', e => problems.push(`pageerror: ${e.message}`));
  await page.waitForSelector('#url');

  await check('a fresh profile shows the empty state', async () => {
    await page.waitForSelector('text=Try a sample video');
  });

  await check('page sends the security headers', async () => {
    const h = (await fetch(ORIGIN)).headers;
    const csp = h.get('content-security-policy');
    assert.match(csp, /default-src 'none'/);
    assert.match(csp, /script-src 'self' 'nonce-/);
    assert.doesNotMatch(csp, /unsafe-inline|unsafe-eval/);
    assert.equal(h.get('x-content-type-options'), 'nosniff');
    assert.equal(h.get('x-frame-options'), 'DENY');
    assert.equal(h.get('x-powered-by'), null);
  });

  await check('served HTML has no inline styles', async () => {
    const html = await (await fetch(ORIGIN)).text();
    assert.doesNotMatch(html, /<style|\sstyle="/);
  });

  await check('splash finishes and leaves', async () => {
    await page.waitForFunction(() => { const s = document.getElementById('splash'); return !s || getComputedStyle(s).display === 'none' || s.hidden; }, null, { timeout: 8000 });
  });
  await shot(page, 'landing');

  await check('D switches theme, also from the empty link box', async () => {
    const theme = () => page.evaluate(() => document.documentElement.dataset.theme || matchMedia('(prefers-color-scheme: dark)').matches);
    const before = await theme();
    await page.focus('#url');
    await page.keyboard.press('d');
    await page.waitForTimeout(700);
    assert.notEqual(await theme(), before);
    assert.equal(await page.inputValue('#url'), '');
  });
  await shot(page, 'landing-flipped');

  await check('a bad link shows a field error, tied to the input', async () => {
    await page.fill('#url', 'not a link');
    await page.keyboard.press('Enter');
    await page.waitForSelector('#url-err');
    assert.equal(await page.getAttribute('#url', 'aria-invalid'), 'true');
    await page.fill('#url', '');
  });

  await check('the playlist page opens empty and comes back', async () => {
    await page.click('nav a[href="/?playlist"]');
    await page.waitForSelector('text=A whole playlist.');
    assert.equal(await page.getAttribute('nav a[href="/?playlist"]', 'aria-current'), 'page');
    assert.equal(await page.getAttribute('nav a[href="/"]', 'aria-current'), null);
    assert.equal(await page.locator('.bar-form').count(), 0);
    await page.waitForTimeout(500);
    await shot(page, 'playlist-empty');
    await page.click('nav a[href="/"]');
    await page.waitForSelector('text=Read any video.');
  });

  await check('no sideways scroll at 320px', async () => {
    await app.evaluate(({ BrowserWindow }) => { const w = BrowserWindow.getAllWindows()[0]; w.setMinimumSize(320, 400); w.setContentSize(320, 700); });
    await page.waitForTimeout(400);
    const { sw, cw } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
    assert.ok(sw <= cw, `scrollWidth ${sw} > clientWidth ${cw}`);
    await shot(page, 'landing-320');
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setContentSize(1200, 860));
  });

  await check('the skip link appears when focused', async () => {
    // Not by Tab: the link box's autofocus puts the tab order past it, and that's the common case's right call.
    const top = await page.evaluate(() => { const a = document.querySelector('.skip'); a.focus(); return new Promise(r => setTimeout(() => r(a.getBoundingClientRect().top), 100)); });
    assert.ok(top >= 0, `top ${top}`);
    await page.evaluate(() => document.activeElement.blur());
  });

  if (!process.env.E2E_OFFLINE) {
    await check('a real video loads, and find counts matches', async () => {
      await page.fill('#url', 'https://www.youtube.com/watch?v=jNQXAC9IVRw');
      await page.keyboard.press('Enter');
      await page.waitForSelector('.reader .para', { timeout: 30000 });
      await page.waitForTimeout(800);
      await shot(page, 'result');
      await page.keyboard.press('Meta+f');
      await page.fill('#find', 'the');
      await page.waitForFunction(() => /of \d+/.test(document.querySelector('.find-bar .count')?.textContent ?? ''));
      assert.ok(await page.locator('mark.find.current').count() >= 1);
      await shot(page, 'result-find');
      await page.keyboard.press('Escape');
      assert.equal(await page.locator('.find-bar').count(), 0);
    });

    await check('a selection can be highlighted, and survives a reload', async () => {
      await page.dblclick('.para p');
      await page.waitForSelector('.pop:not([hidden])');
      await shot(page, 'result-selection');
      await page.click('.pop button:has-text("Highlight")');
      await page.waitForSelector('mark.hl');
      await page.waitForFunction(() => localStorage.length > 0);
      await page.reload();
      await page.waitForSelector('mark.hl', { timeout: 30000 });
      await page.waitForSelector('text=Highlights');
    });

    await check('the video really plays: follow-along lights up, and the mini player docks', async () => {
      await page.click('.poster');
      await page.waitForSelector('.frame iframe', { timeout: 20000 });
      await page.waitForSelector('.para.now', { timeout: 20000 });
      await shot(page, 'result-playing');
      await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setContentSize(700, 420));
      await page.waitForTimeout(300);
      await page.evaluate(() => scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }));
      await page.waitForSelector('.mini:not([hidden])', { timeout: 8000 });
      await shot(page, 'result-mini');
      await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setContentSize(1200, 860));
    });
  }

  await check('no console errors or CSP violations', async () => {
    // A blocked third-party request inside YouTube's own frame isn't ours to fix.
    const ours = problems.filter(p => !/youtube|googlevideo|doubleclick|ggpht/i.test(p));
    assert.deepEqual(ours, []);
    if (problems.length) console.log('# from YouTube, ignored:', problems.length);
  });
} catch (e) {
  failed = true;
  console.error('FAILED:', e.message);
} finally {
  await app.close();
  rmSync(profile, { recursive: true, force: true });
}
console.log(`${passed.length} passed${failed ? ', 1 failed' : ''}`);
process.exit(failed ? 1 : 0);
