import type { NextConfig } from 'next';

const config: NextConfig = {
  // A stray package-lock.json in the home folder would otherwise be taken as the workspace root.
  turbopack: { root: import.meta.dirname },
  // youtubei.js ships its own platform shims; let Node load it as-is instead of bundling it.
  serverExternalPackages: ['youtubei.js'],
};

export default config;
