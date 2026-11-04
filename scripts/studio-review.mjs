import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright';
import { createApp } from './server.mjs';
import { writeFailureReport } from '../lib/review-report.mjs';

const fixture = await mkdtemp(path.join(os.tmpdir(), 'maze-studio-'));
const output = new URL('../.scratch/verification/studio/', import.meta.url);
const app = createApp({ repository: fixture });
let browser;
const errors = [];
try {
  for (const group of ['src', 'docs', 'test']) {
    await mkdir(path.join(fixture, group));
    for (let i = 0; i < 10; i++) await writeFile(path.join(fixture, group, `file-${i}.js`), 'export const value = 1;');
  }
  await mkdir(output, { recursive: true });
  app.listen(0, '127.0.0.1'); await once(app, 'listening');
  const base = `http://127.0.0.1:${app.address().port}`;
  browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'chrome' });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 }, reducedMotion: 'reduce' });
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto(base);
  await page.waitForFunction(() => document.querySelector('#scene')?.dataset.nodes === '30');
  await page.waitForLoadState('networkidle');
  await page.locator('#show-labels').uncheck();
  await page.locator('#studio-photo').click();
  async function samples(count) {
    await page.waitForFunction(count => Number(document.querySelector('#scene').dataset.photoSamples) >= count,
      count, { timeout: 180000 });
  }
  await samples(Number(process.env.STUDIO_SAMPLES || 64));
  const colors = await page.evaluate(() => {
    const source = document.querySelector('.photo-canvas');
    const canvas = document.createElement('canvas');
    canvas.width = source.width; canvas.height = source.height;
    const context = canvas.getContext('2d'); context.drawImage(source, 0, 0);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let red = 0, blue = 0, green = 0, black = 0;
    for (let i = 0; i < pixels.length; i += 4) {
      const [r, g, b] = pixels.slice(i, i + 3);
      if (r > 80 && r > g * 1.35 && r > b * 1.35) red++;
      if (b > 65 && b > r * 1.3 && b > g * 1.2) blue++;
      if (g > 65 && g > r * 1.2 && g > b * 1.2) green++;
      if (r < 12 && g < 12 && b < 12) black++;
    }
    return { red, blue, green, black, pixels: pixels.length / 4 };
  });
  for (const color of ['red', 'blue', 'green']) assert.ok(colors[color] / colors.pixels > 0.0008, `${color} paint remains lit and correctly assigned: ${JSON.stringify(colors)}`);
  assert.ok(colors.black / colors.pixels < 0.01, 'black clearcoat / wrong material regression');
  console.log('Rendered paint coverage:', colors);
  await page.locator('#scene').screenshot({ path: new URL('hero.png', output).pathname });
  console.log('Hero samples:', await page.locator('#scene').getAttribute('data-photo-samples'), 'errors:', errors);
  assert.equal(await page.locator('.photo-canvas').count(), 1);
  assert.equal(await page.locator('#studio-photo').getAttribute('aria-pressed'), 'true');
  const downloadEvent = page.waitForEvent('download');
  await page.locator('#save-photo').click();
  const download = await downloadEvent;
  await download.saveAs(new URL('download.png', output).pathname);
  assert.equal(download.suggestedFilename(), 'code-maze-studio.png');
  const mapCanvas = page.locator('#scene canvas:not(.photo-canvas)');
  await page.evaluate(() => { window.studioGL = document.querySelector('.photo-canvas').getContext('webgl2'); });
  await mapCanvas.focus();
  await mapCanvas.press('ArrowRight');
  assert.equal(await page.locator('#scene').getAttribute('data-photo-samples'), '0', 'orbit invalidates accumulation');
  await samples(8);
  await page.locator('#scene').screenshot({ path: new URL('orbit.png', output).pathname });
  await page.locator('#file-list button').first().click();
  assert.equal(await page.locator('.photo-canvas').count(), 0, 'selection releases studio and restores map');
  await page.waitForFunction(() => window.studioGL.isContextLost());
  assert.match(await page.locator('#detail-meta').textContent(), /file-0/);
  for (let i = 0; i < 2; i++) {
    await page.locator('#studio-photo').click();
    await samples(4);
    await page.locator('#studio-photo').click();
    assert.equal(await page.locator('.photo-canvas').count(), 0);
  }
  // Cancel a lazy import, then try again. There must never be two contexts.
  await page.locator('#studio-photo').click();
  await samples(4);
  await page.evaluate(() => {
    const old = document.querySelector('.photo-canvas'), button = document.querySelector('#studio-photo');
    button.click(); button.click();
    old.dispatchEvent(new Event('webglcontextlost', { cancelable: true }));
  });
  assert.equal(await page.locator('#studio-photo').getAttribute('aria-pressed'), 'true', 'late context loss belongs only to the disposed generation');
  await samples(4);
  await page.locator('#studio-photo').click();
  await page.locator('#studio-photo').click();
  await page.locator('#studio-photo').click();
  assert.equal(await page.locator('#studio-photo').getAttribute('aria-pressed'), 'false');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('#studio-photo').click();
  await samples(8);
  await page.locator('#scene').screenshot({ path: new URL('mobile.png', output).pathname });
  await page.setViewportSize({ width: 1440, height: 1100 });
  await samples(4);
  // A previously selected map must photograph opaque paint, not the fading
  // and emissive overlays used to explain dependencies.
  await page.locator('#scene').screenshot({ path: new URL('after-selection.png', output).pathname });
  await page.locator('#repo-path').fill(fixture);
  await page.locator('#scan-button').click();
  await page.waitForFunction(() => document.querySelector('#status').dataset.state === 'ready');
  assert.equal(await page.locator('.photo-canvas').count(), 0, 'rescan discards old studio');
  await page.locator('#studio-photo').click();
  await samples(4);
  await mapCanvas.focus();
  for (let i = 0; i < 5; i++) await mapCanvas.press('+');
  await samples(32);
  await page.locator('#scene').screenshot({ path: new URL('close.png', output).pathname });
  await page.locator('#studio-photo').click();
  const graph = await (await page.request.get(`${base}/api/scan`)).json();
  const template = graph.nodes[0];
  graph.nodes = Array.from({ length: 600 }, (_, index) => ({ ...template, id: `file-${index}.js`, path: `file-${index}.js`, label: `file-${index}.js`, group: graph.groups[index % graph.groups.length].id }));
  graph.edges = [];
  await page.route('**/api/scan', route => route.fulfill({ json: graph }));
  await page.locator('#scan-button').click();
  await page.waitForFunction(() => document.querySelector('#scene').dataset.nodes === '600');
  await page.waitForFunction(() => document.querySelector('#scene').dataset.support === 'ready', null, { timeout: 180000 });
  const largeStart = Date.now();
  await page.locator('#studio-photo').click();
  await samples(4);
  console.log('600-node studio time to 4 samples (ms):', Date.now() - largeStart);
  await page.locator('#scene').screenshot({ path: new URL('crowded.png', output).pathname });
  await page.locator('#studio-photo').click();
  // Reproduce lost context after a working render; the normal map survives.
  await page.locator('#studio-photo').click();
  await samples(4);
  await page.evaluate(() => document.querySelector('.photo-canvas').getContext('webgl2').getExtension('WEBGL_lose_context').loseContext());
  await page.waitForFunction(() => document.querySelector('#photo-status').textContent.includes('unavailable'));
  assert.equal(await page.locator('.photo-canvas').count(), 0);
  assert.deepEqual(errors, [], 'no shader, context cleanup, or browser errors');
  const degraded = await browser.newPage();
  await degraded.route('**/vendor/pathtracer.js', route => route.abort());
  await degraded.goto(base);
  await degraded.waitForFunction(() => document.querySelector('#scene')?.dataset.nodes === '30');
  await degraded.locator('#studio-photo').click();
  await degraded.waitForFunction(() => document.querySelector('#photo-status').textContent.includes('unavailable'));
  await degraded.locator('#file-list button').first().click();
  assert.match(await degraded.locator('#detail-meta').textContent(), /file-0/);
  assert.equal(await degraded.locator('.photo-canvas').count(), 0);
  console.log('Studio passed: lit RGB paint, actual generated meshes, progressive samples, PNG export, orbit reset, selection/rescan/context cleanup, repeat contexts, mobile resize, 600-node map, context loss and unavailable bundle recovery.');
} catch (error) {
  await writeFailureReport(output.pathname, "studio-review", { error, errors });
  throw error;
} finally {
  await browser?.close();
  app.closeAllConnections(); app.close();
  await rm(fixture, { recursive: true, force: true });
}
