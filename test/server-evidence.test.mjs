import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { once } from "node:events";
import { createApp } from "../scripts/server.mjs";
import { createEvidenceLog, readEvents } from "../lib/evidence.mjs";

const packageVersion = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8")).version;

async function serverFixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), "code-maze-evidence-api-"));
  await mkdir(path.join(root, "other"), { recursive: true });
  await writeFile(path.join(root, "first.js"), "import './other/second.js';");
  await writeFile(path.join(root, "other/second.js"), "");
  const evidenceDir = path.join(root, "evidence");
  const evidence = createEvidenceLog({ dir: evidenceDir, component: "server" });
  const app = createApp({ repository: root, evidence });
  app.listen(0, "127.0.0.1");
  await once(app, "listening");
  t.after(async () => {
    app.closeAllConnections();
    await new Promise((resolve) => app.close(resolve));
    await evidence.close();
    await rm(root, { recursive: true, force: true });
  });
  return { base: `http://127.0.0.1:${app.address().port}`, evidenceDir };
}

test("scan responses carry correlation headers and the store keeps the whole chain", async (t) => {
  const { base, evidenceDir } = await serverFixture(t);
  const response = await fetch(`${base}/api/scan`);
  assert.equal(response.status, 200);
  const op = response.headers.get("x-operation-id");
  assert.match(op, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  assert.equal(response.headers.get("x-app-version"), packageVersion);
  const graph = await response.json();
  await evidenceDrain();
  const stored = await readEvents({ dir: evidenceDir, op, includeChildren: true, limit: 100 });
  const request = stored.events.find((entry) => entry.event === "http.request");
  assert.equal(request.op, op);
  assert.equal(request.status, 200);
  assert.equal(request.route, "/api/scan");
  const finish = stored.events.find((entry) => entry.event === "scan.finish");
  assert.equal(finish.outcome, "success");
  assert.equal(finish.nodes, graph.nodes.length);
  assert.equal(typeof finish.durationMs, "number");
  assert.equal(stored.events.filter((entry) => entry.event === "scan.start").length, 1);
});

async function evidenceDrain() {
  // Event writes are queued asynchronously; give the store a moment to settle.
  await new Promise((resolve) => setTimeout(resolve, 50));
}

test("a failing scan is retained with a categorized error after the response is gone", async (t) => {
  const { base, evidenceDir } = await serverFixture(t);
  const failed = await fetch(`${base}/api/scan`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ path: "/definitely/missing/repo" }) });
  assert.equal(failed.status, 400);
  const op = failed.headers.get("x-operation-id");
  await evidenceDrain();
  const stored = await readEvents({ dir: evidenceDir, op, includeChildren: true, limit: 100 });
  const finish = stored.events.find((entry) => entry.event === "scan.finish");
  assert.equal(finish.outcome, "failure");
  assert.equal(finish.error.category, "path-not-found");
  assert.ok(finish.error.message.includes("missing") || /ENOENT|directory/.test(finish.error.message));
});

test("the diagnostics endpoint stores bounded client events linked to the reported operation", async (t) => {
  const { base, evidenceDir } = await serverFixture(t);
  await fetch(`${base}/api/scan`);
  const related = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
  const bundle = {
    sessionId: "session-1",
    op: related,
    events: [
      { ts: "2026-11-04T09:00:00.000Z", component: "scan", event: "scan.finish", outcome: "failure", op: related, durationMs: 1234.6, error: { category: "server", message: "boom", password: "leak" } },
      { component: "unknown-kind", event: "page.error", outcome: "failure", error: { message: "later" } },
      { component: "scan" },
    ],
  };
  const response = await fetch(`${base}/api/diagnostics`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(bundle) });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { stored: 2, dropped: 1 });
  await evidenceDrain();
  const text = await readFile(path.join(evidenceDir, "events.jsonl"), "utf8");
  assert.ok(!text.includes("leak"), "secrets inside client payloads are stripped before storage");
  const stored = await readEvents({ dir: evidenceDir, op: related, includeChildren: true, limit: 100 });
  const report = stored.events.find((entry) => entry.event === "client.report");
  assert.equal(report.parent, related);
  assert.equal(report.sessionId, "session-1");
  const browserFinish = stored.events.find((entry) => entry.component === "scan" && entry.event === "scan.finish");
  assert.equal(browserFinish.op, related);
  assert.equal(browserFinish.durationMs, 1235);
  assert.equal(browserFinish.clientTs, "2026-11-04T09:00:00.000Z");
  const rehomed = stored.events.find((entry) => entry.component === "page");
  assert.equal(rehomed.event, "page.error");
});

test("oversized diagnostic bodies and event floods are bounded", async (t) => {
  const { base, evidenceDir } = await serverFixture(t);
  const large = await fetch(`${base}/api/diagnostics`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sessionId: "s", events: [], padding: "x".repeat(40000) }) });
  assert.equal(large.status, 413);
  const flood = await fetch(`${base}/api/diagnostics`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sessionId: "s", events: Array.from({ length: 45 }, (_, index) => ({ event: `e${index}` })) }) });
  assert.equal(flood.status, 200);
  assert.deepEqual(await flood.json(), { stored: 40, dropped: 5 });
  await evidenceDrain();
  const stored = await readEvents({ dir: evidenceDir, event: "client.report", limit: 100 });
  const report = stored.events.at(-1);
  assert.equal(report.stored, 40);
  assert.equal(report.dropped, 5);
});

test("health reports the running instance and store state", async (t) => {
  const { base } = await serverFixture(t);
  const health = await fetch(`${base}/api/health`).then((response) => response.json());
  assert.equal(health.version, packageVersion);
  assert.equal(health.node, process.version);
  assert.equal(health.pid, process.pid);
  assert.match(health.startedAt, /^\d{4}-\d{2}-\d{2}T/);
  assert.equal(typeof health.uptimeSeconds, "number");
  assert.equal(health.evidence.writes >= 0, true);
});

test("an app created without an evidence log behaves unchanged", async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "code-maze-no-evidence-"));
  await writeFile(path.join(root, "only.js"), "");
  const app = createApp({ repository: root });
  app.listen(0, "127.0.0.1");
  await once(app, "listening");
  t.after(async () => { app.closeAllConnections(); await new Promise((resolve) => app.close(resolve)); await rm(root, { recursive: true, force: true }); });
  const base = `http://127.0.0.1:${app.address().port}`;
  const response = await fetch(`${base}/api/scan`);
  assert.equal(response.status, 200);
  assert.ok(response.headers.get("x-operation-id"));
  const health = await fetch(`${base}/api/health`).then((response) => response.json());
  assert.equal(health.evidence, null);
});
