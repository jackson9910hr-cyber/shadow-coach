import { defineConfig, type Plugin } from 'vite';
import preact from '@preact/preset-vite';
import { VitePWA } from 'vite-plugin-pwa';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as {
  version: string;
};

// GitHub Pages serves the app from /<repo>/; override with BASE_PATH for other hosts.
// Capacitor builds use BASE_PATH=./ — service workers don't run under capacitor://.
const base = process.env.BASE_PATH ?? '/shadow-coach/';
const nativeShell = base === './';

const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data: blob:",
  "media-src 'self' blob:",
  "connect-src 'self'",
  "worker-src 'self'",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
].join('; ');

/** Adds the CSP only to production builds (the dev server injects inline styles). */
function cspPlugin(): Plugin {
  return {
    name: 'shadow-coach-csp',
    apply: 'build',
    transformIndexHtml: () => [
      {
        tag: 'meta',
        attrs: { 'http-equiv': 'Content-Security-Policy', content: CSP },
        injectTo: 'head-prepend',
      },
    ],
  };
}

export default defineConfig({
  base,
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __NATIVE_SHELL__: JSON.stringify(nativeShell),
  },
  build: { target: 'safari15' },
  plugins: [
    preact(),
    cspPlugin(),
    VitePWA({
      disable: nativeShell,
      // Ask before activating a new version so an in-progress practice session is never reloaded.
      registerType: 'prompt',
      injectRegister: false,
      manifest: {
        id: './',
        name: 'Shadow Coach — 영어 섀도잉 코치',
        short_name: 'Shadow Coach',
        description: '듣고, 따라 말하고, 단어별 정확도를 확인하는 영어 섀도잉 코치',
        lang: 'ko',
        dir: 'ltr',
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#f5f6f8',
        theme_color: '#2b55c8',
        categories: ['education', 'productivity'],
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          {
            src: 'icons/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // App shell + bundled default sentence set are precached (cache-first, versioned).
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/privacy\.html$/],
        cleanupOutdatedCaches: true,
        // No runtime caching: the app makes no network requests besides its own assets.
        runtimeCaching: [],
      },
      devOptions: { enabled: false },
    }),
  ],
});
