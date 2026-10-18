import type { NextConfig } from 'next';

const config: NextConfig = {
  // A self-contained server in .next/standalone, which the desktop app bundles and runs.
  output: 'standalone',
  // A stray package-lock.json in the home folder would otherwise be taken as the workspace root,
  // which would also nest server.js deep inside .next/standalone.
  turbopack: { root: import.meta.dirname },
  outputFileTracingRoot: import.meta.dirname,
  // youtubei.js ships its own platform shims; let Node load it as-is instead of bundling it.
  serverExternalPackages: ['youtubei.js'],
};

export default config;
