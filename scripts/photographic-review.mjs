import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright';
import { createApp } from './server.mjs';
import { writeFailureReport } from '../lib/review-report.mjs';

const fixture = await mkdtemp(path.join(os.tmpdir(), 'maze-photograph-'));
const output = new URL('../.scratch/verification/photographic/', import.meta.url);
const app = createApp({ repository: fixture });
let browser;
const errors = [], external = [];
try {
  for (const group of ['src', 'docs', 'test']) {
    await mkdir(path.join(fixture, group));
    for (let i = 0; i < 10; i++) await writeFile(path.join(fixture, group, `file-${i}.js`), 'export const value=1;');
  }
  await mkdir(output, { recursive: true });
  app.listen(0, '127.0.0.1'); await once(app, 'listening');
  const origin = `http://127.0.0.1:${app.address().port}`;
  browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'chrome' });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 }, reducedMotion: 'reduce' });
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.route('**/*', route => {
    const url = route.request().url();
    if (/^https?:/.test(url) && !url.startsWith(origin + '/')) { external.push(url); return route.abort(); }
    return route.continue();
  });
  // Observe real GPU ownership without exposing diagnostic globals in the app.
  await page.route('**/photo-denoising.js', async route => {
    const source = await readFile(new URL('../docs/photo-denoising.js', import.meta.url), 'utf8');
    assert.ok(source.includes('signal.addEventListener("abort", destroy, { once: true });'));
    assert.ok(source.includes('return {\n      execute(image, done, error)'));
    const body = source.replace('signal.addEventListener("abort", destroy, { once: true });', 'window.photoGPUDevice = device; signal.addEventListener("abort", destroy, { once: true });')
      .replace('return {\n      execute(image, done, error)', 'window.photoNetwork = network; return {\n      execute(image, done, error)');
    await route.fulfill({ contentType: 'text/javascript', body });
  });
  await page.route('**/photo-guides.js', async route => {
    const source = await readFile(new URL('../docs/photo-guides.js', import.meta.url), 'utf8');
    assert.ok(source.includes('return output;'));
    const body = source.replace('return output;', `
      const ray = new THREE.Raycaster();
      ray.setFromCamera(new THREE.Vector2(-1 + 1/width, 1 - 1/height), camera);
      const hit = ray.intersectObjects(scene.children, true)[0];
      const expected = hit.normal.clone().transformDirection(hit.object.matrixWorld).transformDirection(camera.matrixWorldInverse).toArray().map(v=>(v+1)/2);
      window.photoGuides = { width, height, albedo: [...output.albedo.data.slice(0,4)], normal: [...output.normal.data.slice(0,4)], expected };
      return output;`);
    await route.fulfill({ contentType: 'text/javascript', body });
  });
  await page.goto(origin);
  await page.waitForFunction(() => document.querySelector('#scene')?.dataset.nodes === '30');
  await page.waitForLoadState('networkidle');
  assert.ok(await page.evaluate(async () => Boolean(await navigator.gpu?.requestAdapter())), 'this photographic validation requires a real WebGPU adapter');
  await page.locator('#show-labels').uncheck();
  const started = Date.now();
  await page.locator('#studio-photo').click();
  async function ready(name) {
    await page.waitForFunction(() => document.querySelector('#scene').dataset.photo === 'ready', null, { timeout: 240000 });
    assert.equal(await page.locator('#scene').getAttribute('data-photo-samples'), '256', 'capture converged output');
    assert.equal(await page.locator('#scene').getAttribute('data-photo-denoising'), 'oidn', 'actual guided neural inference completed');
    const observed = await page.evaluate(() => ({ runtime: window.photoNetwork.getRuntimeInfo(), guides: window.photoGuides }));
    assert.equal(observed.runtime.inputChannels, 9);
    assert.equal(observed.runtime.gpuEngine, 'wgsl');
    assert.equal(observed.runtime.activeExecutionCount, 0);
    assert.ok(observed.runtime.lastExecution.tileCount > 0);
    assert.ok(Math.abs(observed.guides.albedo[0] - 0.9302) < 0.01, 'floor albedo stays linear, without sRGB or ACES conversion');
    observed.guides.expected.forEach((value, axis) => assert.ok(Math.abs(observed.guides.normal[axis] - value) < 0.005, 'floor/sweep normals match independent camera-ray intersections'));
    await page.locator('#scene').screenshot({ path: new URL(`${name}.png`, output).pathname });
    console.log(JSON.stringify({ view: name, width: observed.guides.width, height: observed.guides.height, precision: observed.runtime.precision, tiles: observed.runtime.lastExecution.tileCount, inferenceMs: observed.runtime.lastExecution.durationMs, resources: observed.runtime.resources }));
  }
  await ready('hero');
  console.log('Time to converged neural hero (ms):', Date.now() - started);
  const heroDownload = page.waitForEvent('download'); await page.locator('#save-photo').click();
  await (await heroDownload).saveAs(new URL('hero-export.png', output).pathname);
  const canvas = page.locator('#scene canvas:not(.photo-canvas)');
  await canvas.focus(); for (let i = 0; i < 5; i++) await canvas.press('+');
  await ready('close');
  const downloading = page.waitForEvent('download'); await page.locator('#save-photo').click();
  const download = await downloading; await download.saveAs(new URL('close-export.png', output).pathname);
  assert.equal(download.suggestedFilename(), 'code-maze-studio.png');
  await canvas.press('0');
  for (let i = 0; i < 4; i++) await canvas.press('ArrowDown');
  await ready('low');
  const horizonStep = await page.evaluate(() => {
    const source = document.querySelector('.photo-canvas');
    const canvas = document.createElement('canvas'); canvas.width = source.width; canvas.height = source.height;
    const context = canvas.getContext('2d'); context.drawImage(source, 0, 0);
    const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
    let previous, maximum = 0;
    // Clear studio bands beside the toy, above the board: no object edges can
    // conceal a full-width floor/background discontinuity in these pixels.
    for (let y = 0; y < canvas.height * 0.55; y++) {
      let sum = 0, count = 0;
      for (let x = 0; x < canvas.width; x++) if (x < canvas.width * 0.12 || x > canvas.width * 0.88) {
        const offset = (y * canvas.width + x) * 4;
        sum += (data[offset] + data[offset + 1] + data[offset + 2]) / 3; count++;
      }
      const value = sum / count;
      if (previous !== undefined) maximum = Math.max(maximum, Math.abs(value - previous));
      previous = value;
    }
    return maximum;
  });
  assert.ok(horizonStep < 6, `seamless low-angle backdrop; largest clear-background row step is ${horizonStep}`);
  console.log('Low-view maximum background row step:', horizonStep);
  const lowDownload = page.waitForEvent('download'); await page.locator('#save-photo').click();
  await (await lowDownload).saveAs(new URL('low-export.png', output).pathname);
  await page.setViewportSize({ width: 390, height: 844 });
  await canvas.press('0'); await ready('mobile');
  await page.locator('#studio-photo').click();
  const lost = await page.evaluate(async () => ({ reason: (await window.photoGPUDevice.lost).reason, resources: window.photoNetwork.getRuntimeInfo().resources }));
  assert.equal(lost.reason, 'destroyed'); assert.equal(lost.resources.live, 0, 'all neural resources explicitly released');
  assert.equal(await page.locator('.photo-canvas').count(), 0);
  assert.deepEqual(errors, []); assert.deepEqual(external, []);

  const cancelled = await browser.newPage({ reducedMotion: 'reduce' });
  const cancelErrors = [];
  cancelled.on('pageerror', e => cancelErrors.push(e.message));
  cancelled.on('console', m => { if (m.type() === 'error') cancelErrors.push(m.text()); });
  await cancelled.route('**/bead-photograph.js', async route => {
    const source = await readFile(new URL('../docs/bead-photograph.js', import.meta.url), 'utf8');
    assert.ok(source.includes('const LIMIT = 256;'));
    await route.fulfill({ contentType: 'text/javascript', body: source.replace('const LIMIT = 256;', 'const LIMIT = 4;') });
  });
  await cancelled.route('**/photo-denoising.js', async route => {
    const source = await readFile(new URL('../docs/photo-denoising.js', import.meta.url), 'utf8');
    await route.fulfill({ contentType: 'text/javascript', body: source.replace('signal.addEventListener("abort", destroy, { once: true });', 'window.photoGPUDevice = device; signal.addEventListener("abort", destroy, { once: true });') });
  });
  await cancelled.goto(origin); await cancelled.waitForFunction(() => document.querySelector('#scene')?.dataset.nodes === '30');
  await cancelled.locator('#studio-photo').click();
  await cancelled.waitForFunction(() => window.photoGPUDevice, null, { timeout: 60000 });
  await cancelled.locator('#studio-photo').click();
  assert.equal(await cancelled.evaluate(async () => (await window.photoGPUDevice.lost).reason), 'destroyed', 'closing during initialization/inference destroys the owned device');
  await cancelled.waitForTimeout(150);
  assert.deepEqual(cancelErrors, []);
  assert.equal(await cancelled.locator('.photo-canvas').count(), 0);

  // Fault paths use fewer photons; these are lifecycle checks, not fidelity shots.
  const fallback = await browser.newPage({ reducedMotion: 'reduce' });
  const fallbackErrors = [];
  fallback.on('pageerror', e => fallbackErrors.push(e.message));
  await fallback.route('**/bead-photograph.js', async route => {
    const source = await readFile(new URL('../docs/bead-photograph.js', import.meta.url), 'utf8');
    await route.fulfill({ contentType: 'text/javascript', body: source.replace('const LIMIT = 256;', 'const LIMIT = 4;') });
  });
  await fallback.route('**/vendor/oidn-*.tza', route => route.abort());
  await fallback.goto(origin); await fallback.waitForFunction(() => document.querySelector('#scene')?.dataset.nodes === '30');
  await fallback.locator('#studio-photo').click();
  await fallback.waitForFunction(() => document.querySelector('#scene').dataset.photo === 'ready', null, { timeout: 60000 });
  assert.equal(await fallback.locator('#scene').getAttribute('data-photo-denoising'), 'spatial');
  await fallback.locator('#file-list button').first().click();
  assert.match(await fallback.locator('#detail-meta').textContent(), /file-0/);
  assert.deepEqual(fallbackErrors, []);
  await fallback.unroute('**/vendor/oidn-*.tza');
  await fallback.addInitScript(() => Object.defineProperty(navigator, 'gpu', { value: undefined, configurable: true }));
  const models = [];
  fallback.on('request', request => { if (request.url().endsWith('.tza')) models.push(request.url()); });
  await fallback.reload(); await fallback.waitForFunction(() => document.querySelector('#scene')?.dataset.nodes === '30');
  await fallback.locator('#studio-photo').click();
  await fallback.waitForFunction(() => document.querySelector('#scene').dataset.photo === 'ready', null, { timeout: 60000 });
  assert.equal(await fallback.locator('#scene').getAttribute('data-photo-denoising'), 'spatial');
  assert.deepEqual(models, [], 'unsupported WebGPU skips the model and guide work');
  assert.deepEqual(fallbackErrors, []);
  console.log('Photographic validation passed: converged hero/close/low/mobile, seamless low-angle backdrop, actual guided OIDN, linear albedo and encoded normals, PNG export, device/resource release, cancellation during initialization/inference, local-only assets, missing-model fallback. Photographic indistinguishability is not established by this test.');
} catch (error) {
  await writeFailureReport(output.pathname, "photographic-review", { error, errors, external });
  throw error;
} finally {
  await browser?.close(); app.closeAllConnections(); app.close();
  await rm(fixture, { recursive: true, force: true });
}
