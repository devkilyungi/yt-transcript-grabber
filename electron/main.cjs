// Desktop shell: runs the standalone Next server in a utility process and shows it in a window.
const { app, BrowserWindow, Menu, dialog, nativeTheme, shell, utilityProcess } = require('electron');
const fs = require('node:fs');
const net = require('node:net');
const path = require('node:path');

// A fixed origin, so localStorage (notes, settings, recent videos) survives restarts.
// It differs from `npm run dev` (8765), so both can run at once.
const HOST = '127.0.0.1';
const PORT = 8766;
const ORIGIN = `http://${HOST}:${PORT}`;

const serverDir = app.isPackaged
  ? path.join(process.resourcesPath, 'server')
  : path.join(__dirname, '..', '.next', 'standalone');

let server = null;
let win = null;
let quitting = false;

/* ---------- Server ---------- */

function portFree() {
  return new Promise(resolve => {
    const probe = net.createServer()
      .once('error', () => resolve(false))
      .once('listening', () => probe.close(() => resolve(true)))
      .listen(PORT, HOST);
  });
}

async function waitForServer(timeoutMs = 20000) {
  const until = Date.now() + timeoutMs;
  while (Date.now() < until) {
    try {
      if ((await fetch(ORIGIN, { method: 'HEAD' })).ok) return;
    } catch {}
    await new Promise(r => setTimeout(r, 150));
  }
  throw new Error(`The server didn't respond within ${timeoutMs / 1000}s.`);
}

function startServer() {
  const entry = path.join(serverDir, 'server.js');
  if (!fs.existsSync(entry)) {
    throw new Error(`No server build at ${entry}. Run \`npm run app\`, which builds it first.`);
  }
  const log = fs.createWriteStream(path.join(app.getPath('logs'), 'server.log'), { flags: 'a' });
  server = utilityProcess.fork(entry, [], {
    cwd: serverDir,
    env: { ...process.env, NODE_ENV: 'production', HOSTNAME: HOST, PORT: String(PORT) },
    stdio: 'pipe',
    serviceName: 'Transcript Grabber server',
  });
  server.stdout.pipe(log);
  server.stderr.pipe(log);
  server.once('exit', code => {
    server = null;
    if (quitting) return;
    dialog.showErrorBox('Transcript Grabber stopped', `The local server exited (code ${code}). See ${log.path}.`);
    app.quit();
  });
}

/* ---------- Window ---------- */

function createWindow() {
  win = new BrowserWindow({
    width: 1200,
    height: 860,
    minWidth: 380,
    minHeight: 520,
    show: false,
    title: 'Transcript Grabber',
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#121110' : '#f6f3ee',
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), sandbox: true, contextIsolation: true },
  });
  win.once('ready-to-show', () => win.show());
  win.on('closed', () => { win = null; });

  // Links to YouTube, GitHub and the like open in the default browser; the app only shows its own pages.
  const external = url => !url.startsWith(`${ORIGIN}/`) && url !== ORIGIN;
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (external(url)) shell.openExternal(url);
    else win.loadURL(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e, url) => {
    if (!external(url)) return;
    e.preventDefault();
    shell.openExternal(url);
  });

  win.loadURL(ORIGIN);
}

function buildMenu() {
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { role: 'appMenu' },
    { role: 'editMenu' },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    { role: 'windowMenu' },
  ]));
}

/* ---------- Lifecycle ---------- */

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!win) return createWindow();
    if (win.isMinimized()) win.restore();
    win.focus();
  });

  app.whenReady().then(async () => {
    buildMenu();
    try {
      if (!(await portFree())) {
        throw new Error(`Port ${PORT} is already in use. Quit whatever is using it and open the app again.`);
      }
      startServer();
      await waitForServer();
    } catch (err) {
      dialog.showErrorBox("Transcript Grabber couldn't start", err.message);
      quitting = true;
      server?.kill();
      return app.quit();
    }
    createWindow();
  });

  // macOS convention: closing the window keeps the app in the Dock; clicking it reopens the window.
  app.on('activate', () => { if (!win && server) createWindow(); });
  app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
  app.on('before-quit', () => { quitting = true; server?.kill(); });
}
