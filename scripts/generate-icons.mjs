// Renders public/icons/icon.svg to the PNG sizes required by iOS and the web manifest.
// Usage: node scripts/generate-icons.mjs  (uses the Playwright Chromium already installed)
import { chromium } from '@playwright/test';
import { readFile } from 'node:fs/promises';

const svg = await readFile(new URL('../public/icons/icon.svg', import.meta.url), 'utf8');
const targets = [
  { file: 'icon-192.png', size: 192, pad: 0 },
  { file: 'icon-512.png', size: 512, pad: 0 },
  // Maskable: keep artwork inside the 80% safe zone.
  { file: 'icon-maskable-512.png', size: 512, pad: 0.1 },
  { file: 'apple-touch-icon.png', size: 180, pad: 0 },
];

const executablePath = process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium';
const browser = await chromium.launch({ executablePath }).catch(() => chromium.launch());
const page = await browser.newPage();
for (const { file, size, pad } of targets) {
  const inner = Math.round(size * (1 - pad * 2));
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<body style="margin:0;background:#2b55c8;display:grid;place-items:center;width:${size}px;height:${size}px">` +
      `<div style="width:${inner}px;height:${inner}px">${svg.replace('<svg ', '<svg width="100%" height="100%" ')}</div></body>`,
  );
  await page.screenshot({
    path: new URL(`../public/icons/${file}`, import.meta.url).pathname,
    omitBackground: false,
  });
  console.log('wrote', file);
}
await browser.close();
