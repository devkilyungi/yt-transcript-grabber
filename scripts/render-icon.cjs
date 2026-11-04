// Renders build/icon.svg to build/icon.png (1024px, which electron-builder turns into the app icon),
// and public/favicon.svg to the web manifest's PNG sizes.
// Run with: npx electron scripts/render-icon.cjs
const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');

async function render(source, size, out) {
  const svg = fs.readFileSync(path.join(root, source), 'utf8').replace('<svg ', `<svg style="display:block;width:${size}px;height:${size}px" `);
  const win = new BrowserWindow({ width: size, height: size, show: false, transparent: true, frame: false,
    useContentSize: true, webPreferences: { offscreen: true } });
  await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(`<html><body style="margin:0;background:transparent">${svg}</body></html>`)}`);
  const image = await win.webContents.capturePage({ x: 0, y: 0, width: size, height: size });
  fs.writeFileSync(path.join(root, out), image.resize({ width: size, height: size }).toPNG());
  console.log('Wrote', out);
  win.destroy();
}

app.on('window-all-closed', () => {}); // each render closes its window; the last line quits
app.whenReady().then(async () => {
  await render('build/icon.svg', 1024, 'build/icon.png');
  for (const size of [180, 192, 512]) await render('public/favicon.svg', size, `public/icon-${size}.png`);
  app.quit();
});
