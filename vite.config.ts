import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as {
  version: string;
};

// GitHub Pages serves the app from /<repo>/; override with BASE_PATH for other hosts
// (Capacitor builds use BASE_PATH=./).
export default defineConfig({
  base: process.env.BASE_PATH ?? '/shadow-coach/',
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  plugins: [preact()],
});
