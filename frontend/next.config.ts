import type { NextConfig } from 'next';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const nextConfig: NextConfig = {
  reactStrictMode: true,
  turbopack: {
    root,
  },
};

export default nextConfig;
