import assert from "node:assert/strict";
import { once } from "node:events";
import { readFile, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { chromium } from "playwright";
import { createApp } from "./server.mjs";

const fixture = await mkdtemp(path.join(os.tmpdir(), "maze-textures-"));
const app = createApp({ repository: fixture }); let browser;
const materials = await readFile("docs/bead-materials.js", "utf8");
const vendor = await readFile("docs/vendor/pathtracer.js", "utf8");
try {
  for (const group of ["src", "docs", "test"]) {
    await mkdir(path.join(fixture, group));
    for (let i = 0; i < 10; i++) await writeFile(path.join(fixture, group, `file-${i}.js`), "export const value=1;");
  }
  app.listen(0, "127.0.0.1"); await once(app, "listening");
  browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || "chrome" });
  for (const mode of ["delayed", "deadline", "corrupt"]) {
    const page = await browser.newPage({ reducedMotion: "reduce" }), errors = [];
    page.on("pageerror", e => errors.push(e.message));
    page.on("console", m => { if (m.type() === "error") errors.push(m.text()); });
    let release;
    const held = new Promise(resolve => { release = resolve; });
    await page.route("**/birch_ply_edge_*_1k.png", async route => {
      if (mode === "corrupt") return route.fulfill({ contentType: "image/png", body: "invalid-png" });
      await held;
      return route.fulfill({ contentType: "image/png", path: `docs/vendor/${new URL(route.request().url()).pathname.split("/").at(-1)}` });
    });
    await page.route("**/bead-materials.js", route => {
      assert.ok(materials.includes("ready: Promise.all(pending)"));
      let body = materials.replace("ready: Promise.all(pending)", "ready: Promise.all(pending).then(() => { window.testPly=ply; window.testMaterialsReady=true; })");
      if (mode === "deadline") {
        assert.ok(body.includes("setTimeout(failed, 15000)"));
        body = body.replace("setTimeout(failed, 15000)", "setTimeout(failed, 60)");
      }
      return route.fulfill({ contentType: "text/javascript", body });
    });
    await page.route("**/vendor/pathtracer.js", route => route.fulfill({ contentType: "text/javascript", body: "window.testVendorReady=true;\n" + vendor }));
    await page.goto(`http://127.0.0.1:${app.address().port}`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => document.querySelector("#scene")?.dataset.support === "ready");
    if (mode === "delayed") {
      await page.locator("#studio-photo").click(); await page.waitForFunction(() => window.testVendorReady);
      assert.equal(await page.locator(".photo-canvas").count(), 0, "no GPU photograph is allocated with pending material images");
      assert.equal(await page.locator("#scene").getAttribute("data-photo"), "preparing");
      await page.locator("#studio-photo").click();
      await page.locator("#scan-button").click();
      await page.waitForFunction(() => document.querySelector("#scene").dataset.support === "ready");
      release(); await page.waitForFunction(() => window.testMaterialsReady);
      assert.equal(await page.locator("#scene").getAttribute("data-photo"), "off");
      assert.equal(await page.locator(".photo-canvas").count(), 0, "late readiness does not revive the cancelled photo");
    } else {
      await page.waitForFunction(() => window.testMaterialsReady);
      const size = await page.evaluate(() => [window.testPly.map.image.width, window.testPly.normalMap.image.width]);
      assert.deepEqual(size, [1, 1], "bad or stalled assets become valid fallback pixels");
    }
    await page.locator("#studio-photo").click();
    await page.waitForFunction(() => Number(document.querySelector("#scene").dataset.photoSamples) >= 4, null, { timeout: 120000 });
    if (mode === "deadline") {
      release(); await page.waitForLoadState("networkidle");
      assert.deepEqual(await page.evaluate(() => [window.testPly.map.image.width, window.testPly.normalMap.image.width]), [1, 1], "late real images retain the fallback already packed by this photo");
    }
    await page.locator("#studio-photo").click();
    assert.equal(await page.locator(".photo-canvas").count(), 0);
    assert.deepEqual(errors, []);
    release(); await page.close();
    console.log(`Texture ${mode}: readiness/cancellation/fallback and actual traced samples passed.`);
  }
} finally {
  await browser?.close(); app.closeAllConnections(); app.close(); await rm(fixture, { recursive: true, force: true });
}
