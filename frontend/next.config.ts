import type { NextConfig } from 'next';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const development = process.env.NODE_ENV !== 'production';

if (process.env.NODE_ENV === 'production' && !process.env.NEXT_PUBLIC_API_URL) {
  throw new Error('NEXT_PUBLIC_API_URL is required for production builds');
}

// The browser may only call this app and the CRM API. Local development additionally allows the dev API and hot reload.
const apiOrigin = (() => {
  try { return new URL(process.env.NEXT_PUBLIC_API_URL ?? '').origin; } catch { return ''; }
})();
const connectSources = ["'self'", apiOrigin, ...(development ? ['http://localhost:*', 'ws://localhost:*'] : [])].filter(Boolean).join(' ');

const securityHeaders = [
  // frame-src blob: lets "Print" load the consent PDF into a hidden frame; nothing else may be framed.
  { key: 'Content-Security-Policy', value: `default-src 'self'; base-uri 'self'; frame-ancestors 'none'; object-src 'none'; form-action 'self'; frame-src 'self' blob:; img-src 'self' https: data: blob:; font-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'${development ? " 'unsafe-eval'" : ''}; connect-src ${connectSources}; worker-src 'self' blob:` },
  ...(development ? [] : [{ key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' }]),
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  poweredByHeader: false,
  async headers() {
    return [{ source: '/(.*)', headers: securityHeaders }];
  },
  turbopack: {
    root,
  },
};

export default nextConfig;
