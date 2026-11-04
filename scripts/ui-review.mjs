import assert from "node:assert/strict";
import { once } from "node:events";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import { createApp } from "./server.mjs";
import { writeFailureReport } from "../lib/review-report.mjs";

const fixture = await mkdtemp(path.join(os.tmpdir(), "code-maze-ui-"));
const output = new URL("../.scratch/verification/", import.meta.url);
const app = createApp({ repository: fixture });
let browser;
const errors = [];
try {
  await mkdir(path.join(fixture, "src"));
  await writeFile(path.join(fixture, "src/main.js"), "import './helper.js';\nexport const start = true;");
  await writeFile(path.join(fixture, "src/helper.js"), "export const value = 42;");
  await writeFile(path.join(fixture, "README.md"), "A project for curious minds.");
  await mkdir(output, { recursive: true });
  app.listen(0, "127.0.0.1");
  await once(app, "listening");
  const base = `http://127.0.0.1:${app.address().port}`;
  browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || "chrome", headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
  async function newPage() {
    const page = await context.newPage();
    page.on("pageerror", (error) => errors.push(error.message));
    return page;
  }
  async function ready(page) {
    await page.goto(base);
    await page.waitForFunction(() => document.querySelector("#status")?.dataset.state === "ready");
  }
  async function accessible(page, name) {
    const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
    assert.deepEqual(result.violations.map(({ id, nodes }) => ({ id, targets: nodes.map((node) => node.target) })), [], name);
  }
  const page = await newPage();
  await ready(page);
  await accessible(page, "desktop accessibility");
  await page.keyboard.press("Tab");
  assert.equal(await page.locator(".skip-link").evaluate((element) => element === document.activeElement), true);
  await page.keyboard.press("Enter");
  assert.equal(await page.locator("#playground").evaluate((element) => element === document.activeElement), true);

  await page.locator("#guide-next").focus();
  await page.keyboard.press("Enter");
  assert.equal(await page.locator("#detail-meta").textContent(), "src/main.js");
  assert.match(await page.locator("#guide-step").textContent(), /1 of 3/);
  await page.locator("#guide-next").click();
  assert.match(await page.locator("#guide-body").textContent(), /main.js uses helper.js/);
  await page.waitForFunction(() => document.querySelector("#scene").dataset.referenceMotion === "playing");
  await page.locator("#motion-toggle").click();
  assert.equal(await page.locator("body").getAttribute("data-motion"), "off");
  assert.equal(await page.locator("#scene").getAttribute("data-reference-motion"), "idle");
  await page.locator("#guide-next").click();
  assert.equal(await page.locator("#detail-meta").textContent(), "src/helper.js");
  assert.match(await page.locator("#guide-step").textContent(), /3 of 3 · complete/);
  assert.equal(await page.locator("body > canvas").count(), 0, "motion-off tour creates no confetti canvas");
  await page.locator("#guide-next").click();
  await page.locator("#file-list button").filter({ hasText: "README.md" }).click();
  assert.match(await page.locator("#guide-step").textContent(), /3 steps/, "manual selection resets an interrupted tour");
  assert.match(await page.locator("#detail-story").textContent(), /solo bead/i);

  await page.locator("#file-search").fill("<script>🧩\u202e no such bead");
  assert.equal(await page.locator("#file-list button").count(), 0);
  assert.equal(await page.locator("#empty-search").isVisible(), true);
  await page.locator("#clear-search").click();
  assert.equal(await page.locator("#file-list button").count(), 3);
  assert.equal(await page.locator("#file-search").evaluate((element) => element === document.activeElement), true);
  await page.reload();
  await page.waitForFunction(() => document.querySelector("#status").dataset.state === "ready");
  assert.equal(await page.locator("body").getAttribute("data-motion"), "off", "motion choice persists");
  await page.locator("#motion-toggle").click();
  await page.locator("#guide-next").click();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.waitForFunction(() => document.body.dataset.motion === "off");
  assert.equal(await page.locator("body").getAttribute("data-motion"), "off");
  assert.equal(await page.locator("#motion-toggle").isDisabled(), true);
  assert.equal(await page.locator("#scene").getAttribute("data-reference-motion"), "idle");
  await page.locator("#guide-next").click();
  await page.locator("#guide-next").click();
  assert.equal(await page.locator("body > canvas").count(), 0);
  await accessible(page, "reduced-motion selected state accessibility");
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.waitForFunction(() => !document.querySelector("#motion-toggle").disabled);
  assert.equal(await page.locator("#motion-toggle").isDisabled(), false);

  for (const width of [320, 390, 768, 980, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `${width}px reflow`);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator("#guide-next").click();
  assert.equal(await page.locator("#mobile-tour").isVisible(), true);
  assert.equal(await page.locator("#mobile-tour-next").evaluate((element) => element === document.activeElement), true, "mobile tour keeps keyboard focus on a visible next action");
  const dock = await page.locator("#mobile-tour").boundingBox();
  assert.ok(dock.y >= 0 && dock.y + dock.height < 844, "tour instructions remain visible near the maze");
  await page.locator("#mobile-tour-next").click();
  await page.locator("#mobile-tour-next").click();
  assert.match(await page.locator("#mobile-tour-heading").textContent(), /3 \/ 3/);
  await accessible(page, "mobile tour accessibility");
  await page.screenshot({ path: new URL("ui-tour-mobile.png", output).pathname, fullPage: true });
  await page.locator("#end-tour").click();
  assert.equal(await page.locator("#mobile-tour").isVisible(), false);
  assert.equal(await page.locator("#scene canvas").evaluate((element) => element === document.activeElement), true);

  const data = await (await page.request.get(`${base}/api/scan`)).json();
  const crowded = await newPage();
  const crowdedGraph = structuredClone(data);
  const template = data.nodes.find((node) => node.id === "src/main.js");
  crowdedGraph.nodes = Array.from({ length: 80 }, (_, index) => ({ ...template, id: `src/module-${index}.js`, path: `src/module-${index}.js`, label: `module-${index}.js` }));
  crowdedGraph.edges = [];
  await crowded.route("**/api/scan", (route) => route.fulfill({ json: crowdedGraph }));
  await ready(crowded);
  for (let index = 0; index < 30; index++) await crowded.locator("#file-list").getByRole("button", { name: `src/module-${index}.js`, exact: true }).click();
  await crowded.locator("#show-labels").uncheck();
  await crowded.locator("#reset-view").click();
  await crowded.waitForFunction(() => document.querySelectorAll(".file-label.is-selected").length === 1);
  assert.equal(await crowded.locator(".file-label.is-selected").textContent(), "src/module-29.js", "hidden labels never retain previous selection markers");
  assert.equal(await crowded.locator(".file-label.is-selected").isVisible(), true);
  await crowded.close();
  for (const mode of ["empty", "isolated", "self"]) {
    const probe = await newPage();
    const graph = structuredClone(data);
    if (mode === "empty") { graph.nodes = []; graph.groups = []; graph.edges = []; }
    if (mode === "isolated") graph.edges = [];
    if (mode === "self") graph.edges = [{ source: "src/main.js", target: "src/main.js", kind: "import" }];
    await probe.route("**/api/scan", (route) => route.fulfill({ json: graph }));
    await ready(probe);
    if (mode === "empty") {
      assert.equal(await probe.locator("#guide-next").isDisabled(), true);
      assert.match(await probe.locator("#detail-meta").textContent(), /No beads/);
    } else if (mode === "isolated") {
      assert.match(await probe.locator("#guide-body").textContent(), /No file references/);
      await probe.locator("#guide-next").click();
      assert.match(await probe.locator("#detail-story").textContent(), /solo bead/i);
    } else {
      for (let index = 0; index < 3; index++) await probe.locator("#guide-next").click();
      assert.match(await probe.locator("#guide-body").textContent(), /refers to itself/);
    }
    await probe.close();
  }
  const fallback = await newPage();
  await fallback.setViewportSize({ width: 390, height: 844 });
  await fallback.route("**/vendor/three.module.js", (route) => route.fulfill({ contentType: "text/javascript", body: "" }));
  await ready(fallback);
  assert.match(await fallback.locator("#scene-help").textContent(), /Flat view/);
  assert.equal(await fallback.locator("#reset-view").isVisible(), false);
  await fallback.locator("#guide-next").click();
  await fallback.locator("#mobile-tour-next").click();
  await fallback.locator("#mobile-tour-next").click();
  assert.equal(await fallback.locator("#scene").getAttribute("data-selected"), "src/helper.js");
  await fallback.locator("#end-tour").click();
  assert.equal(await fallback.locator("#file-search").evaluate((element) => element === document.activeElement), true);
  await accessible(fallback, "fallback tour accessibility");

  const noEffects = await newPage();
  await noEffects.route(/vendor\/(anime\.esm\.min\.js|confetti\.module\.mjs)/, (route) => route.fulfill({ status: 503, body: "unavailable" }));
  await noEffects.addInitScript(() => { Object.defineProperty(window, "localStorage", { get() { throw new Error("Storage unavailable"); } }); });
  await ready(noEffects);
  for (let index = 0; index < 3; index++) await noEffects.locator("#guide-next").click();
  assert.equal(await noEffects.locator("#detail-meta").textContent(), "src/helper.js", "core tour works with unavailable effect libraries and storage");
  assert.equal(await noEffects.locator("#scene").getAttribute("data-reference-motion"), "idle", "missing animation library leaves no frozen traveling particles");
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.screenshot({ path: new URL("ui-reviewed-desktop.png", output).pathname, fullPage: true });
  assert.deepEqual(errors, [], "no uncaught browser errors");
  console.log("UI review passed: keyboard guide, real reference direction, tour interruption, empty search, 320–1440px reflow, mobile guide, live reduced motion, saved motion choice, empty/isolated/self-reference maps, flat fallback, unavailable effects/storage, and zero WCAG A/AA axe violations in four states.");
} catch (error) {
  await writeFailureReport(output.pathname, "ui-review", { error, errors });
  throw error;
} finally {
  await browser?.close();
  app.closeAllConnections();
  if (app.listening) await new Promise((resolve) => app.close(resolve));
  await rm(fixture, { recursive: true, force: true });
}
