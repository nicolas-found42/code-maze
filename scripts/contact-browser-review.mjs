import assert from "node:assert/strict";
import { once } from "node:events";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { chromium } from "playwright";
import { createApp } from "./server.mjs";

const fixture = await mkdtemp(path.join(os.tmpdir(), "maze-contact-ui-"));
const app = createApp({ repository: fixture });
let browser;
try {
  for (const group of ["src", "docs", "test"]) {
    await mkdir(path.join(fixture, group));
    for (let i = 0; i < 10; i++) await writeFile(path.join(fixture, group, `file-${i}.js`), "export const value=1;");
  }
  app.listen(0, "127.0.0.1"); await once(app, "listening");
  const origin = `http://127.0.0.1:${app.address().port}`;
  browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || "chrome" });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 }, reducedMotion: "reduce" });
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
  await page.addInitScript(() => {
    const NativeWorker = window.Worker;
    window.contactWorkers = [];
    window.Worker = class extends NativeWorker {
      constructor(...args) { super(...args); if (String(args[0]).includes("bead-seating-worker.js")) window.contactWorkers.push(this); }
      postMessage(value, ...args) { this.contactInput = value; super.postMessage(value, ...args); }
      terminate() { this.terminated = true; super.terminate(); }
    };
  });
  await page.route("**/bead-seating-client.js", async route => {
    const source = await readFile(new URL("../docs/bead-seating-client.js", import.meta.url), "utf8");
    assert.ok(source.includes("else finish(result);"));
    await route.fulfill({ contentType: "text/javascript", body: source.replace("else finish(result);", "else { window.contactResult = result; finish(result); }") });
  });
  await page.route("**/bead-scene.js", async route => {
    const source = await readFile(new URL("../docs/bead-scene.js", import.meta.url), "utf8");
    assert.ok(source.includes("seating.run(seatingInput(graph, baseTop))"));
    await route.fulfill({ contentType: "text/javascript", body: source.replace("seating.run(seatingInput(graph, baseTop))", "window.renderedContactMeshes = ownedMeshes; seating.run(seatingInput(graph, baseTop))") });
  });
  let delayNext = false;
  await page.route("**/bead-seating-worker.js", async route => {
    let source = await readFile(new URL("../docs/bead-seating-worker.js", import.meta.url), "utf8");
    if (delayNext) {
      delayNext = false;
      source = source.replace("self.onmessage = event => {", "const execute = event => {") + "\nself.onmessage = event => setTimeout(() => execute(event), 1500);";
    }
    await route.fulfill({ contentType: "text/javascript", body: source });
  });
  const started = Date.now();
  await page.goto(origin);
  await page.waitForFunction(() => document.querySelector("#scene")?.dataset.support === "ready", null, { timeout: 120000 });
  const observed = await page.evaluate(() => ({ result: window.contactResult,
    rendered: window.renderedContactMeshes.map(mesh => mesh.position.toArray()),
    original: window.contactWorkers[0].contactInput.nodes.map(node => node.position),
    terminated: window.contactWorkers.every(worker => worker.terminated) }));
  assert.equal(observed.result.positions.length, 30);
  assert.deepEqual(observed.rendered, observed.result.positions, "actual rendered meshes receive the verified poses");
  assert.ok(observed.rendered.some((position, i) => Math.hypot(...position.map((v, axis) => v - observed.original[i][axis])) > 0.1));
  assert.ok(observed.result.contacts.every(contact => contact.gap < 0.1));
  assert.ok(observed.terminated, "completed workers release their CPU heaps");
  console.log("Time to supported 30-bead map (ms):", Date.now() - started);
  await page.locator("#studio-photo").click();
  await page.waitForFunction(() => Number(document.querySelector("#scene").dataset.photoSamples) >= 4, null, { timeout: 60000 });
  await page.locator("#studio-photo").click();

  delayNext = true;
  await page.locator("#scan-button").click();
  await page.waitForFunction(() => window.contactWorkers.length === 2 && document.querySelector("#scene").dataset.support === "working");
  assert.equal(await page.locator("#studio-photo").isDisabled(), true);
  await page.locator("#file-list button").first().click();
  assert.match(await page.locator("#detail-meta").textContent(), /file-0/);
  assert.match(await page.locator("#photo-status").textContent(), /Finishing the toy/);
  await page.locator("#scan-button").click();
  await page.waitForFunction(() => window.contactWorkers.length === 3 && document.querySelector("#scene").dataset.support === "ready", null, { timeout: 120000 });
  const beforeLate = await page.evaluate(() => window.renderedContactMeshes.map(mesh => mesh.position.toArray()));
  await page.evaluate(() => window.contactWorkers[1].dispatchEvent(new MessageEvent("message", { data: {
    positions: Array.from({ length: 30 }, () => [99999, 99999, 99999]),
    contacts: Array.from({ length: 30 }, () => ({ gap: 0.03, displacement: 2 })),
  } })));
  assert.deepEqual(await page.evaluate(() => window.renderedContactMeshes.map(mesh => mesh.position.toArray())), beforeLate);
  assert.ok(await page.evaluate(() => window.contactWorkers.every(worker => worker.terminated)));
  const empty = await (await page.request.get(`${origin}/api/scan`)).json();
  empty.nodes = []; empty.edges = []; empty.groups = [];
  await page.route("**/api/scan", route => route.fulfill({ json: empty }));
  await page.locator("#scan-button").click();
  await page.waitForFunction(() => document.querySelector("#scene").dataset.nodes === "0" && document.querySelector("#scene").dataset.support === "ready");
  assert.equal(await page.evaluate(() => window.contactWorkers.length), 3, "an empty map needs no contact worker");

  // These controlled workers exercise failure delivery, not contact quality.
  for (const mode of ["error", "invalid"]) {
    const failed = await browser.newPage({ reducedMotion: "reduce" });
    const failures = []; failed.on("pageerror", error => failures.push(error.message));
    await failed.route("**/bead-seating-worker.js", route => route.fulfill({ contentType: "text/javascript", body: mode === "error"
      ? "self.onmessage = () => self.postMessage({ error: 'controlled failure' });"
      : "self.onmessage = e => self.postMessage({ positions: e.data.nodes.map(() => [NaN,2,3]), contacts: e.data.nodes.map(() => ({gap:.03,displacement:2})) });" }));
    await failed.goto(origin);
    await failed.waitForFunction(() => document.querySelector("#scene")?.dataset.support === "failed");
    assert.equal(await failed.locator("#studio-photo").isDisabled(), true);
    await failed.locator("#file-list button").first().click();
    assert.match(await failed.locator("#detail-meta").textContent(), /file-0/);
    assert.deepEqual(failures, []); await failed.close();
  }
  assert.deepEqual(errors, []);
  console.log("Contact browser passed: actual rendered poses, photo readiness, worker termination, responsive selection during work, rescan cancellation/stale message isolation, and error/malformed-result recovery.");
} finally {
  await browser?.close(); app.closeAllConnections(); app.close();
  await rm(fixture, { recursive: true, force: true });
}
