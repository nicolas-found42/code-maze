import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createEvidenceLog, readEvents, redactPath, EVIDENCE_VERSION } from "../lib/evidence.mjs";

async function store(t) {
  const dir = await mkdtemp(path.join(os.tmpdir(), "code-maze-evidence-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  return dir;
}

test("emitted events persist as JSON lines with the fixed envelope", async (t) => {
  const dir = await store(t);
  const log = createEvidenceLog({ dir, component: "tester" });
  await log.emit("scan.finish", { op: "op-1", parent: "req-1", outcome: "failure", durationMs: 12, error: { category: "path-not-found", message: "missing" }, root: "/tmp/repo" });
  await log.close();
  const [file] = await readdir(dir);
  const entry = JSON.parse(await readFile(path.join(dir, file), "utf8"));
  assert.equal(entry.v, EVIDENCE_VERSION);
  assert.equal(entry.component, "tester");
  assert.equal(entry.event, "scan.finish");
  assert.equal(entry.op, "op-1");
  assert.equal(entry.outcome, "failure");
  assert.equal(entry.durationMs, 12);
  assert.deepEqual(entry.error, { category: "path-not-found", message: "missing" });
  assert.match(entry.ts, /^\d{4}-\d{2}-\d{2}T/);
});

test("per-event component override marks client-reported events", async (t) => {
  const dir = await store(t);
  const log = createEvidenceLog({ dir, component: "server" });
  await log.emit("scan.finish", { component: "scan", outcome: "failure" });
  await log.close();
  const entry = JSON.parse(await readFile(path.join(dir, "events.jsonl"), "utf8"));
  assert.equal(entry.component, "scan");
});

test("rotation keeps a bounded number of bounded files and drops the oldest", async (t) => {
  const dir = await store(t);
  const log = createEvidenceLog({ dir, component: "tester", maxBytes: 300, maxFiles: 3, now: () => "2026-11-04T00:00:00.000Z" });
  for (let i = 0; i < 16; i++) await log.emit("tick", { index: i });
  await log.close();
  const files = (await readdir(dir)).sort();
  assert.ok(files.length <= 4, `unexpected file count: ${files}`);
  for (const file of files) assert.ok((await stat(path.join(dir, file))).size <= 400, `${file} exceeds the byte bound`);
  const lines = (await Promise.all(files.map((file) => readFile(path.join(dir, file), "utf8")))).join("").trim().split("\n");
  assert.ok(lines.length < 16, `oldest rotated events were dropped (kept ${lines.length})`);
  assert.ok(log.stats().rotations > 0);
});

test("secret-looking fields are stripped at any depth before storage", async (t) => {
  const dir = await store(t);
  const log = createEvidenceLog({ dir, component: "tester" });
  await log.emit("probe", { password: "nope", nested: { apiToken: "nope", keep: 1 }, authorization: "nope", note: "kept" });
  await log.close();
  const text = await readFile(path.join(dir, "events.jsonl"), "utf8");
  assert.ok(!text.includes("nope"));
  const entry = JSON.parse(text);
  assert.equal(entry.note, "kept");
  assert.equal(entry.nested.keep, 1);
});

test("long strings are truncated to bounded lengths", async (t) => {
  const dir = await store(t);
  const log = createEvidenceLog({ dir, component: "tester" });
  await log.emit("probe", { error: { category: "x", message: "m".repeat(1000) }, detail: "d".repeat(1000) });
  await log.close();
  const entry = JSON.parse(await readFile(path.join(dir, "events.jsonl"), "utf8"));
  assert.ok(entry.error.message.length <= 300);
  assert.ok(entry.detail.length <= 400);
});

test("oversized entries drop their fields but never exceed the line bound", async (t) => {
  const dir = await store(t);
  const log = createEvidenceLog({ dir, component: "tester" });
  const blob = Object.fromEntries(Array.from({ length: 40 }, (_, index) => [`field${index}`, "y".repeat(400)]));
  await log.emit("probe", blob);
  await log.close();
  const text = await readFile(path.join(dir, "events.jsonl"), "utf8").then((text) => text.trimEnd());
  assert.ok(Buffer.byteLength(text) <= 8192, `line is ${Buffer.byteLength(text)} bytes`);
  const entry = JSON.parse(text);
  assert.equal(entry.truncated, true);
  assert.ok(entry.droppedFields.includes("field39"));
  assert.equal(log.stats().droppedByOverflow, 1);
});

test("an unwritable store never throws and reports failures once", async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "code-maze-evidence-block-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const blocker = path.join(root, "blocker");
  await writeFile(blocker, "a file where a directory would be");
  let reported = 0;
  const log = createEvidenceLog({ dir: blocker, component: "tester", onWriteFailure: () => { reported += 1; } });
  await log.emit("probe", {});
  await log.emit("probe", {});
  await log.close();
  assert.equal(reported, 1, "write failures surface once, not per event");
  assert.equal(log.stats().writes, 0);
  assert.ok(log.stats().writeFailures >= 2);
});

test("the reader reports corrupt lines, respects filters, and distinguishes an empty store", async (t) => {
  const dir = await store(t);
  await writeFile(path.join(dir, "events.jsonl"),
    `${JSON.stringify({ v: 1, ts: "2026-11-03T10:00:00.000Z", component: "scan", event: "scan.start", op: "a" })}\n` +
    "not json\n" +
    `${JSON.stringify({ v: 1, component: "scan", event: "no-timestamp" })}\n` +
    `${JSON.stringify({ v: 1, ts: "2026-11-04T10:00:00.000Z", component: "server", event: "scan.finish", op: "a", outcome: "success" })}\n`);
  const all = await readEvents({ dir });
  assert.equal(all.corrupt, 2);
  assert.equal(all.totalLines, 2);
  assert.equal(all.events.length, 2);
  assert.equal(all.range.earliest, "2026-11-03T10:00:00.000Z");
  const windowed = await readEvents({ dir, since: "2026-11-04T00:00:00Z" });
  assert.deepEqual(windowed.events.map((entry) => entry.event), ["scan.finish"]);
  const chained = await readEvents({ dir, op: "a", includeChildren: true });
  assert.equal(chained.events.length, 2);
  const missing = await readEvents({ dir: path.join(dir, "absent") });
  assert.equal(missing.missing, true);
  assert.equal(missing.events.length, 0);
});

test("redactPath collapses the home directory and truncates", () => {
  const home = os.homedir();
  assert.equal(redactPath(path.join(home, "projects", "repo")), path.join("~", "projects", "repo"));
  assert.equal(redactPath("/var/tmp/repo"), "/var/tmp/repo");
  assert.ok(redactPath("x".repeat(500)).length <= 400);
});
