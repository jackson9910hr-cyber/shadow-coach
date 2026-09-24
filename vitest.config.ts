import { defineConfig } from 'vitest/config';
import preact from '@preact/preset-vite';

export default defineConfig({
  plugins: [preact()],
  define: { __APP_VERSION__: JSON.stringify('test') },
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      include: ['src/core/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/core/index.ts'],
      reporter: ['text', 'html', 'json-summary'],
      thresholds: { lines: 90, branches: 90, functions: 90, statements: 90 },
    },
  },
});
