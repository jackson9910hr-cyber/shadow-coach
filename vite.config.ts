import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';

// GitHub Pages serves the app from /<repo>/; override with BASE_PATH for other hosts.
export default defineConfig({
  base: process.env.BASE_PATH ?? '/shadow-coach/',
  plugins: [preact()],
});
