// electron-builder leaves node_modules out of extraResources, so the bundled server
// would start without next, react or youtubei.js. Copy them in after packing.
const fs = require('node:fs');
const path = require('node:path');

exports.default = async function afterPack(context) {
  const app = `${context.packager.appInfo.productFilename}.app`;
  const src = path.join(__dirname, '..', '.next', 'standalone', 'node_modules');
  const dest = path.join(context.appOutDir, app, 'Contents', 'Resources', 'server', 'node_modules');
  if (!fs.existsSync(src)) throw new Error(`No ${src}. Run \`npm run build:server\` first.`);
  fs.rmSync(dest, { recursive: true, force: true });
  // Dereference, so pnpm-style links inside the standalone output become real folders.
  fs.cpSync(src, dest, { recursive: true, dereference: true });
};
