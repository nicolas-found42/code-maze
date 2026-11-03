import assert from "node:assert/strict";
import { once } from "node:events";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { chromium } from "playwright";
import { createApp } from "./server.mjs";

const fixture = await mkdtemp(path.join(os.tmpdir(), "maze-fidelity-"));
const output = new URL("../.scratch/verification/fidelity/", import.meta.url);
const app = createApp({ repository: fixture });
const baseline = process.env.FIDELITY_BASELINE;
let browser;
try {
  for (const group of ["src", "docs", "test"]) {
    await mkdir(path.join(fixture, group));
    for (let index = 0; index < 10; index++) await writeFile(path.join(fixture, group, `file-${index}.js`), index ? "export const value = 1;" : "import './file-1.js';");
  }
  await mkdir(output, { recursive: true });
  app.listen(0, "127.0.0.1"); await once(app, "listening");
  const base = `http://127.0.0.1:${app.address().port}`;
  browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || "chrome" });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 }, reducedMotion: "reduce" });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  if (baseline) await page.route("**/bead-scene.js", async (route) => route.fulfill({ contentType: "text/javascript", body: await readFile(baseline, "utf8") }));
  await page.goto(base);
  await page.waitForFunction(() => document.querySelector("#scene")?.dataset.nodes === "30");
  if (!baseline) await page.waitForFunction(() => document.querySelector("#scene")?.dataset.shading === "n8ao");
  await page.waitForLoadState("networkidle");
  await page.locator("#show-labels").uncheck();
  const canvas = page.locator("#scene canvas");
  async function shot(name) { await page.locator("#scene").screenshot({ path: new URL(`${baseline ? "before-" : ""}${name}.jpg`, output).pathname, type: "jpeg", quality: 92 }); }
  await shot("hero");
  await canvas.focus();
  for (let i = 0; i < 5; i++) await canvas.press("+");
  await shot("close");
  await canvas.press("ArrowRight"); await canvas.press("ArrowDown");
  await shot("low");
  if (baseline) { console.log("Recorded original geometry and lighting at identical fixture/cameras."); }
  else {
    const withAO = await page.locator("#scene").screenshot();
    const withoutAO = await browser.newPage({ viewport: { width: 1440, height: 1100 }, reducedMotion: "reduce" });
    await withoutAO.route("**/bead-rendering.js", async (route) => {
      const source = await readFile(new URL("../docs/bead-rendering.js", import.meta.url), "utf8");
      assert.match(source, /intensity: 1\.5/);
      await route.fulfill({ contentType: "text/javascript", body: source.replace("intensity: 1.5", "intensity: 0") });
    });
    await withoutAO.goto(base);
    await withoutAO.waitForFunction(() => document.querySelector("#scene")?.dataset.shading === "n8ao");
    await withoutAO.waitForLoadState("networkidle");
    await withoutAO.locator("#show-labels").uncheck();
    await withoutAO.locator("#scene canvas").focus();
    for (let i = 0; i < 5; i++) await withoutAO.locator("#scene canvas").press("+");
    await withoutAO.locator("#scene canvas").press("ArrowRight");
    await withoutAO.locator("#scene canvas").press("ArrowDown");
    const withoutAOImage = await withoutAO.locator("#scene").screenshot();
    await withoutAO.locator("#scene").screenshot({ path: new URL("ao-off.jpg", output).pathname, type: "jpeg", quality: 92 });
    assert.notDeepEqual(withAO, withoutAOImage, "AO changes the rendered image with identical geometry, materials, tone mapping and camera");
    await withoutAO.close();
    assert.equal(await page.locator("#scene").getAttribute("data-denoising"), "neural");
    await page.locator("#file-list button").first().click();
    await shot("selected");
    assert.equal(await page.locator(".file-label.is-selected").count(), 1);
    assert.equal(await page.locator("#scene").getAttribute("data-shading"), "n8ao");

    // Instrument the real renderer only in this browser test, including GPU
    // synchronization. No diagnostic globals are added to the application.
    await page.evaluate(() => {
      const gl = document.querySelector("#scene canvas").getContext("webgl2");
      window.fidelityGL = gl;
      window.fidelityResources = {};
      for (const resource of ["Buffer", "Texture", "Renderbuffer"]) {
        window.fidelityResources[resource] = 0;
        for (const [action, change] of [["create", 1], ["delete", -1]]) {
          const name = action + resource, original = gl[name].bind(gl);
          gl[name] = (...args) => { const result = original(...args); window.fidelityResources[resource] += change; return result; };
        }
      }
    });
    await page.evaluate(async () => {
      const { PerspectiveCamera } = await import("./vendor/three.module.js");
      const update = PerspectiveCamera.prototype.updateProjectionMatrix;
      PerspectiveCamera.prototype.updateProjectionMatrix = function (...args) {
        window.fidelityFrustum = { near: this.near, far: this.far };
        return update.apply(this, args);
      };
    });
    async function frameTime() {
      return page.evaluate(async () => {
        const started = performance.now();
        document.querySelector("#scene canvas").dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft" }));
        await new Promise(requestAnimationFrame);
        window.fidelityGL.finish();
        return Math.round(performance.now() - started);
      });
    }
    await page.locator("#reset-view").click();
    await page.locator("#repo-path").fill(fixture);
    async function rescan() {
      await page.locator("#scan-button").click();
      await page.waitForFunction(() => document.querySelector("#status")?.dataset.state === "ready");
      await frameTime();
    }
    await rescan();
    assert.ok(await page.evaluate(() => window.fidelityFrustum.far / window.fidelityFrustum.near < 1000), "camera preserves useful depth precision on a small map");
    const memory = await page.evaluate(() => ({ ...window.fidelityResources }));
    for (let i = 0; i < 3; i++) await rescan();
    assert.deepEqual(await page.evaluate(() => ({ ...window.fidelityResources })), memory,
      "rescans dispose old graph resources while retaining shared model/studio resources");
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForFunction(() => document.querySelector("#scene")?.dataset.denoising === "poisson");
    await shot("mobile");
    await page.setViewportSize({ width: 1440, height: 1100 });
    await page.waitForFunction(() => document.querySelector("#scene")?.dataset.denoising === "neural");

    const graph = await (await page.request.get(`${base}/api/scan`)).json();
    const template = graph.nodes[0];
    graph.nodes = Array.from({ length: 600 }, (_, index) => ({ ...template, id: `file-${index}.js`, path: `file-${index}.js`, label: `file-${index}.js`, group: graph.groups[index % graph.groups.length].id }));
    graph.edges = [];
    await page.route("**/api/scan", (route) => route.fulfill({ json: graph }));
    await rescan();
    assert.equal(await page.locator("#scene").getAttribute("data-nodes"), "600");
    assert.ok(await page.evaluate(() => window.fidelityFrustum.far / window.fidelityFrustum.near < 1000), "camera preserves useful depth precision on a large map");
    const timing = [];
    for (let i = 0; i < 3; i++) timing.push(await frameTime());
    const gpu = await page.evaluate(() => {
      const gl = window.fidelityGL;
      const ext = gl.getExtension("WEBGL_debug_renderer_info");
      return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : "unavailable";
    });
    console.log(JSON.stringify({ nodes: 600, synchronizedOrbitFrameMs: timing, gpu, rescanMemory: memory }));
    await shot("crowded");
    assert.deepEqual(errors, [], "no browser or shader errors");

    const degraded = await browser.newPage({ reducedMotion: "reduce" });
    const degradedErrors = [];
    degraded.on("pageerror", (error) => degradedErrors.push(error.message));
    await degraded.route("**/vendor/fidelity.js", (route) => route.abort());
    await degraded.route(/vendor\/.*\.jpg$/, (route) => route.abort());
    await degraded.goto(base);
    await degraded.waitForFunction(() => document.querySelector("#scene")?.dataset.nodes === "30");
    await degraded.locator("#file-list button").first().click();
    await degraded.locator("#scene canvas").press("ArrowLeft");
    assert.equal(await degraded.locator("#scene").getAttribute("data-renderer"), "webgl");
    assert.equal(await degraded.locator("#scene").getAttribute("data-shading"), "direct");
    assert.match(await degraded.locator("#detail-meta").textContent(), /file-0/);
    assert.deepEqual(degradedErrors, [], "missing optional studio tools/textures retain interaction");
    await degraded.close();
    const recovery = await browser.newPage({ reducedMotion: "reduce" });
    const recoveryErrors = [];
    recovery.on("pageerror", (error) => recoveryErrors.push(error.message));
    await recovery.goto(base);
    await recovery.waitForFunction(() => document.querySelector("#scene")?.dataset.shading === "n8ao");
    await recovery.evaluate(async () => {
      const { EffectComposer } = await import("./vendor/fidelity.js");
      const { BufferGeometry } = await import("./vendor/three.module.js");
      const dispose = BufferGeometry.prototype.dispose;
      window.disposedAOQuads = 0;
      BufferGeometry.prototype.dispose = function () {
        if (this.attributes.position?.count === 3 && this.attributes.position.itemSize === 2) window.disposedAOQuads++;
        return dispose.call(this);
      };
      EffectComposer.prototype.render = () => { throw new Error("Injected pipeline failure"); };
    });
    await recovery.locator("#scene canvas").press("ArrowLeft");
    await recovery.waitForFunction(() => document.querySelector("#scene")?.dataset.shading === "direct");
    await recovery.locator("#file-list button").first().click();
    assert.match(await recovery.locator("#detail-meta").textContent(), /file-0/);
    assert.ok(await recovery.evaluate(() => window.disposedAOQuads > 0), "fallback releases N8AO custom fullscreen resources");
    assert.deepEqual(recoveryErrors, [], "runtime compositor failure returns to working direct rendering");
    console.log("Fidelity review passed: five shapes, hero/close/low/selection/mobile and AO-off captures, neural/Poisson resize, fitted depth precision, stable rescan resources, 600-file map, missing-tool/texture recovery, and runtime compositor fault with custom-quad disposal.");
  }
} finally {
  await browser?.close();
  app.closeAllConnections();
  if (app.listening) await new Promise((resolve) => app.close(resolve));
  await rm(fixture, { recursive: true, force: true });
}
