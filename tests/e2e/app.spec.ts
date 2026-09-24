import { expect, test, type Page } from '@playwright/test';

/** Installs a scripted Web Speech API so the real recognizer adapter runs end to end. */
async function fakeSpeech(page: Page, transcript: string) {
  await page.addInitScript((heard) => {
    class FakeRecognition {
      lang = '';
      continuous = false;
      interimResults = false;
      maxAlternatives = 1;
      onresult: ((e: unknown) => void) | null = null;
      onerror: ((e: unknown) => void) | null = null;
      onend: (() => void) | null = null;
      start() {
        setTimeout(() => {
          const result = Object.assign([{ transcript: heard }], { isFinal: true });
          this.onresult?.({ results: [result] });
          this.onend?.();
        }, 50);
      }
      stop() {}
      abort() {}
    }
    const w = window as unknown as Record<string, unknown>;
    w.SpeechRecognition = FakeRecognition;
    w.webkitSpeechRecognition = FakeRecognition;
  }, transcript);
}

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  return errors;
}

test('practice loop scores speech, persists progress across reloads', async ({ page }) => {
  const errors = collectErrors(page);
  await fakeSpeech(page, 'could you share the update delivery schedule on friday');
  await page.goto('./');
  await page.getByRole('button', { name: /학습 시작/ }).click();
  await page.getByRole('button', { name: /따라 말하기/ }).click();
  await expect(page.getByText('78%')).toBeVisible();
  await expect(page.getByText('다음 복습: 내일')).toBeVisible();
  await page.getByRole('button', { name: /the updated delivery schedule by Friday/ }).click();
  await expect(page.getByText('구간 연습')).toBeVisible();

  // Fresh page load: progress must come back from IndexedDB.
  await page.goto('./#/');
  await page.reload();
  await expect(page.getByRole('heading', { name: /학습할 문장\s+9개/ })).toBeVisible();
  await expect(page.locator('.stat dd').nth(1)).toHaveText('78%');
  expect(errors).toEqual([]);
});

test('works offline after the first visit (service worker precache)', async ({ page, context }) => {
  const errors = collectErrors(page);
  await page.goto('./');
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  // Reload once so the page is controlled by the service worker.
  await page.reload();
  await expect
    .poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller)))
    .toBe(true);

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: '오늘의 섀도잉' })).toBeVisible();
  await page.goto('./#/library');
  await expect(page.getByRole('heading', { name: '문장 목록' })).toBeVisible();
  await expect(page.getByText('30문장')).toBeVisible();

  // Offline: speaking falls back to self-grading.
  await page.goto('./#/');
  await page.getByRole('button', { name: /학습 시작/ }).click();
  await page.getByRole('button', { name: /따라 말하기/ }).click();
  // Headless Chromium has no microphone, so recording fails and grading starts without playback.
  await expect(page.getByText(/녹음을 시작할 수 없어요/)).toBeVisible();
  await expect(page.getByText(/틀리거나 빠뜨린 단어/)).toBeVisible();
  await page.getByRole('button', { name: 'updated', exact: true }).click();
  await page.getByRole('button', { name: /채점 완료/ }).click();
  await expect(page.getByText('89%')).toBeVisible();
  await context.setOffline(false);
  // Offline network errors (e.g. service worker update checks) are expected; nothing else.
  expect(errors.filter((e) => !/Failed to load resource/.test(e))).toEqual([]);
});

test('serves a valid manifest and icons', async ({ page, request }) => {
  await page.goto('./');
  const href = await page.locator('link[rel="manifest"]').getAttribute('href');
  const manifest = await (await request.get(new URL(href!, page.url()).toString())).json();
  expect(manifest).toMatchObject({ short_name: 'Shadow Coach', display: 'standalone', lang: 'ko' });
  for (const icon of manifest.icons) {
    const res = await request.get(new URL(icon.src, new URL(href!, page.url())).toString());
    expect(res.status()).toBe(200);
  }
});
