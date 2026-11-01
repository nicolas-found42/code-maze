import assert from "node:assert/strict";
import { once } from "node:events";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { createApp } from "./server.mjs";

const project = fileURLToPath(new URL("../", import.meta.url));
const fixture = await mkdtemp(path.join(os.tmpdir(), "code-maze-smoke-"));
const output = path.join(project, ".scratch/verification");
const app = createApp({ repository: fixture });
let browser;
try {
  await mkdir(path.join(fixture, "src"));
  await writeFile(path.join(fixture, "src/main.js"), "import './helper.js';");
  await writeFile(path.join(fixture, "src/helper.js"), "export const value = 42;");
  await writeFile(path.join(fixture, "README.md"), "A real temporary repository.");
  await mkdir(output, { recursive: true });
  app.listen(0, "127.0.0.1");
  await once(app, "listening");
  const base = `http://127.0.0.1:${app.address().port}`;
  browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || "chrome", headless: true });
  const page = await browser.newPage({ viewport: { width: 1320, height: 1000 }, deviceScaleFactor: 2 });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("response", (response) => {
    if (response.status() >= 400 && !response.url().endsWith("/api/scan")) errors.push(`HTTP ${response.status()} ${response.url()}`);
  });
  await page.goto(base);
  await page.waitForFunction(() => document.querySelector("#scene")?.dataset.nodes === "3");
  assert.equal(await page.locator("#scene").getAttribute("data-renderer"), "webgl");
  assert.equal(await page.locator("#scene").getAttribute("data-edges"), "1");
  assert.equal(await page.locator("#scene").getAttribute("data-tracks"), "2");
  async function assertCanvasViewport() {
    const size = await page.locator("#scene").evaluate((element) => {
      const canvas = element.querySelector("canvas"), rectangle = canvas.getBoundingClientRect();
      return { viewportWidth: element.clientWidth, viewportHeight: element.clientHeight,
        displayWidth: rectangle.width, displayHeight: rectangle.height,
        drawingWidth: canvas.width, drawingHeight: canvas.height };
    });
    assert.ok(Math.abs(size.displayWidth - size.viewportWidth) < 1 && Math.abs(size.displayHeight - size.viewportHeight) < 1,
      `Retina canvas must match the camera's CSS viewport: ${JSON.stringify(size)}`);
    assert.ok(Math.abs(size.drawingWidth - size.viewportWidth * 2) <= 1 && Math.abs(size.drawingHeight - size.viewportHeight * 2) <= 1,
      "Retina drawing buffer keeps its resolution without enlarging the displayed canvas");
  }
  await assertCanvasViewport();
  for (const viewport of [{ width: 980, height: 800 }, { width: 390, height: 844 }, { width: 1320, height: 1000 }]) {
    await page.setViewportSize(viewport);
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await assertCanvasViewport();
  }
  assert.equal(await page.locator(".track-label.is-selected").count(), 0);
  await page.getByRole("button", { name: "src/main.js", exact: true }).click();
  assert.equal(await page.locator("#detail-meta").textContent(), "src/main.js");
  assert.equal(await page.locator("#scene").getAttribute("data-selected"), "src/main.js");
  assert.equal(await page.locator(".file-label.is-selected").textContent(), "src/main.js");
  assert.match(await page.locator("#connections").textContent(), /References \(1\).*src\/helper.js/);
  const helperLabel = await page.locator(".file-label").filter({ hasText: "helper.js" }).boundingBox();
  assert.ok(helperLabel, "file names are visible on the scene");
  let picked = false;
  for (const dy of [8, 16, 24, 32, 40]) {
    for (const dx of [0, -10, 10, -20, 20]) {
      const x = helperLabel.x + helperLabel.width / 2 + dx;
      const y = helperLabel.y + helperLabel.height + dy;
      await page.mouse.move(x, y);
      if (await page.locator(".bead-tooltip").evaluate((element) => !element.hidden && element.textContent === "src/helper.js")) {
        await page.mouse.click(x, y); picked = true; break;
      }
    }
    if (picked) break;
  }
  assert.ok(picked, "a visible bead can be hovered and clicked directly");
  assert.equal(await page.locator("#detail-meta").textContent(), "src/helper.js");
  await page.locator("#file-list").getByRole("button", { name: "src/main.js", exact: true }).click();
  await page.getByLabel("Find a file").fill("helper");
  assert.equal(await page.locator("#file-list button").count(), 1);
  await page.getByLabel("File names", { exact: true }).uncheck();
  await page.waitForFunction(() => document.querySelectorAll(".file-label:not([hidden])").length === 1);
  assert.equal(await page.locator(".file-label:not([hidden])").count(), 1, "the selected file label remains visible when other names are hidden");
  await page.getByLabel("File names", { exact: true }).check();
  await page.getByRole("button", { name: "Reset view", exact: true }).click();
  const canvas = page.locator("#scene canvas");
  await canvas.focus();
  const beforeOrbit = await canvas.screenshot();
  await canvas.press("ArrowLeft");
  const afterOrbit = await canvas.screenshot();
  assert.notDeepEqual(beforeOrbit, afterOrbit, "keyboard orbit changes the visible maze");
  await page.getByRole("button", { name: "Reset view", exact: true }).click();
  await page.screenshot({ path: path.join(output, "live-map.png"), fullPage: true });

  await page.getByLabel("Local repository path").fill(path.join(fixture, "missing"));
  await page.getByRole("button", { name: "Generate map", exact: true }).click();
  await page.waitForFunction(() => document.querySelector("#status").dataset.state === "error");
  assert.match(await page.locator("#status").textContent(), /Still showing/);
  await page.getByLabel("Local repository path").fill(path.join(fixture, "src"));
  await page.getByRole("button", { name: "Generate map", exact: true }).click();
  await page.waitForFunction(() => document.querySelector("#status").dataset.state === "ready");
  assert.equal(await page.locator("#scene").getAttribute("data-nodes"), "2");

  const fallback = await browser.newPage({ viewport: { width: 390, height: 844 } });
  fallback.on("pageerror", (error) => errors.push(error.message));
  await fallback.route("**/vendor/three.min.js", (route) => route.fulfill({ contentType: "text/javascript", body: "" }));
  await fallback.goto(base);
  await fallback.waitForFunction(() => document.querySelector("#scene")?.dataset.nodes === "3");
  assert.equal(await fallback.locator("#scene").getAttribute("data-renderer"), "canvas2d");
  await fallback.getByRole("button", { name: "src/main.js", exact: true }).click();
  assert.equal(await fallback.locator("#detail-meta").textContent(), "src/main.js");
  assert.ok(await fallback.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "mobile layout fits the viewport");
  await fallback.screenshot({ path: path.join(output, "fallback-mobile.png"), fullPage: true });

  const snapshotApp = createApp({ staticRoot: path.join(project, "dist") });
  snapshotApp.listen(0, "127.0.0.1");
  await once(snapshotApp, "listening");
  try {
    let apiCalled = false;
    const snapshot = await browser.newPage();
    snapshot.on("pageerror", (error) => errors.push(error.message));
    await snapshot.route("**/api/scan", (route) => { apiCalled = true; return route.abort(); });
    await snapshot.goto(`http://127.0.0.1:${snapshotApp.address().port}`);
    await snapshot.waitForFunction(() => Number(document.querySelector("#scene")?.dataset.nodes) > 0);
    assert.ok(await snapshot.getByLabel("Local repository path").isDisabled());
    assert.match(await snapshot.locator("#status").textContent(), /Saved snapshot/);
    assert.equal(apiCalled, false, "static exports do not depend on the local scan API");
  } finally { snapshotApp.closeAllConnections(); await new Promise((resolve) => snapshotApp.close(resolve)); }
  assert.deepEqual(errors, []);
  console.log(`Browser smoke passed: WebGL, selection, search, rescan, errors, mobile canvas fallback, and static export.\nScreenshots: ${output}`);
} finally {
  await browser?.close();
  app.closeAllConnections();
  await new Promise((resolve) => app.close(resolve));
  await rm(fixture, { recursive: true, force: true });
}
