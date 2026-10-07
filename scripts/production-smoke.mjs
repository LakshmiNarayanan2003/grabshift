import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';

// Serve the real build below a repository subdirectory, exactly as on Pages.
const root = resolve('dist');
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png' };
const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    if (!pathname.startsWith('/grabshift/')) { response.writeHead(404).end(); return; }
    const file = resolve(root, pathname.slice('/grabshift/'.length) || 'index.html');
    if (!file.startsWith(root + sep)) { response.writeHead(403).end(); return; }
    const contents = await readFile(file);
    response.writeHead(200, { 'Content-Type': mime[extname(file)] ?? 'application/octet-stream' }).end(contents);
  } catch { response.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const { port } = server.address();
let browser;
try {
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [], failed = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', e => { if (e.type() === 'error') errors.push(e.text()); });
  page.on('response', r => { if (r.status() >= 400) failed.push(`${r.status()} ${r.url()}`); });
  await page.goto(`http://127.0.0.1:${port}/grabshift/`);
  for (const file of ['LICENSE', 'THIRD_PARTY_NOTICES.md']) {
    const notice = await page.request.get(`http://127.0.0.1:${port}/grabshift/${file}`);
    assert.equal(notice.status(), 200, `${file} ships with the static site`);
    assert.ok((await notice.text()).includes('Permission is hereby granted'));
  }
  await page.getByRole('button', { name: 'PLAY GAME' }).click();
  await page.getByRole('button', { name: 'CONTINUE', exact: true }).click();
  await page.getByRole('button', { name: 'LET’S GRAB' }).click();
  await page.waitForFunction(() => document.querySelector('#round-message strong')?.textContent === 'GRAB!');
  assert.equal(await page.evaluate(() => '__GRABSHIFT__' in window), false, 'development hook is absent from release');
  await page.keyboard.down('d'); await page.keyboard.down('ArrowLeft');
  await page.waitForTimeout(250);
  await page.keyboard.press('w'); await page.keyboard.press('ArrowUp');
  await page.keyboard.press('g'); await page.keyboard.press('k');
  await page.waitForTimeout(250);
  await page.keyboard.up('d'); await page.keyboard.up('ArrowLeft');
  await page.keyboard.press('F3'); await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'RESUME', exact: true }).waitFor();
  await page.setViewportSize({ width: 1024, height: 768 });
  const bounds = await page.locator('canvas').boundingBox();
  assert.ok(Math.abs(bounds.width / bounds.height - 16 / 9) < 0.01);
  await page.getByRole('button', { name: 'MAIN MENU', exact: true }).click();
  // Menu images are recreated on return; wait for decoding before checking them.
  for (const selector of ['.menu-art img', '.brand-mark']) {
    assert.equal(await page.locator(selector).evaluate(async img => {
      await img.decode();
      return img.complete && img.naturalWidth > 0;
    }), true, `${selector} loads beneath the repository subdirectory`);
  }
  // Exercise solo mode in the actual release bundle, without the development hook.
  await page.getByRole('button', { name: 'PLAY GAME' }).click();
  await page.getByLabel('GAME MODE').selectOption('bot');
  await page.getByLabel('BOT DIFFICULTY').selectOption('hard');
  await page.getByRole('button', { name: 'CONTINUE', exact: true }).click();
  await page.getByRole('button', { name: 'LET’S GRAB' }).click();
  await page.waitForFunction(() => document.querySelector('#round-message strong')?.textContent === 'GRAB!');
  assert.equal(await page.locator('.p2 .player-label').textContent(), 'BOT · HARD');
  const botX = () => page.locator('canvas').evaluate(canvas => {
    const context = canvas.getContext('2d');
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let sum = 0, count = 0;
    for (let index = 0; index < pixels.length; index += 4) {
      // The orange ragdoll is the only orange geometry in the arena.
      if (pixels[index] > 245 && pixels[index + 1] > 160 && pixels[index + 1] < 185 && pixels[index + 2] > 108 && pixels[index + 2] < 132) {
        sum += index / 4 % canvas.width; count++;
      }
    }
    if (count < 100) throw new Error('Bot silhouette was not rendered');
    return sum / count;
  });
  const startX = await botX();
  await page.waitForTimeout(1000);
  assert.ok(await botX() < startX - 40, 'bot visibly moves without keyboard input');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'MAIN MENU', exact: true }).click();
  assert.deepEqual(errors, [], 'no browser errors'); assert.deepEqual(failed, [], 'all subpath assets load');
  console.log('Production smoke passed: /grabshift/ assets, local keyboard play, solo bot movement, mode/difficulty selection, pause, resize, no debug hook, no console errors.');
} finally { if (browser) await browser.close(); await new Promise(resolve => server.close(resolve)); }
