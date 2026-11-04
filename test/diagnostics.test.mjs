import test from "node:test";
import assert from "node:assert/strict";
import { createDiagnostics, installDiagnostics } from "../docs/diagnostics.js";

class FakeStorage {
  constructor({ quotaError = false } = {}) { this.map = new Map(); this.quotaError = quotaError; }
  getItem(key) { return this.map.has(key) ? this.map.get(key) : null; }
  setItem(key, value) {
    if (this.quotaError) throw new Error("QuotaExceededError");
    this.map.set(key, String(value));
  }
  dump() { return this.map.get("code-maze:diagnostics"); }
}

function fakeClock() { let ticks = 0; return () => `2026-11-04T00:00:${String(ticks++).padStart(2, "0")}.000Z`; }

test("records persist across a reload and restore into a new instance", () => {
  const storage = new FakeStorage();
  const first = createDiagnostics({ storage, persistent: new FakeStorage(), now: fakeClock() });
  first.record({ component: "scan", event: "scan.finish", outcome: "success" });
  first.record({ component: "renderer", event: "renderer.fallback", outcome: "fallback" });
  const second = createDiagnostics({ storage, persistent: new FakeStorage(), now: fakeClock() });
  assert.deepEqual(second.events().map((entry) => entry.event), ["scan.finish", "renderer.fallback"]);
});

test("the ring drops the oldest events beyond the limit", () => {
  const diagnostics = createDiagnostics({ storage: new FakeStorage(), persistent: new FakeStorage(), now: fakeClock() });
  for (let index = 0; index < 65; index++) diagnostics.record({ component: "page", event: `e${index}` });
  const events = diagnostics.events();
  assert.equal(events.length, 60);
  assert.equal(events[0].event, "e5");
  assert.equal(events.at(-1).event, "e64");
});

test("persistence stays under the byte cap by dropping the oldest half", () => {
  const storage = new FakeStorage();
  const diagnostics = createDiagnostics({ storage, persistent: new FakeStorage(), now: fakeClock() });
  for (let index = 0; index < 30; index++) diagnostics.record({ component: "page", event: `e${index}`, fields: { blob: "x".repeat(2000) } });
  const size = storage.dump().length;
  assert.ok(size <= 26000, `persisted payload is ${size} bytes`);
  assert.ok(diagnostics.events().length >= 1);
});

test("quota failures never throw and degrade to a bounded tail", () => {
  const storage = new FakeStorage({ quotaError: true });
  const diagnostics = createDiagnostics({ storage, persistent: new FakeStorage(), now: fakeClock() });
  for (let index = 0; index < 20; index++) diagnostics.record({ component: "page", event: `e${index}` });
  assert.equal(diagnostics.events().length, 4, "degrades to the bounded in-memory tail when storage refuses writes");
});

test("secret-looking fields are stripped and the renderer snapshot is allowlisted", () => {
  const diagnostics = createDiagnostics({
    storage: new FakeStorage(), persistent: new FakeStorage(), now: fakeClock(),
    snapshot: () => ({ renderer: "webgl", support: "ready", secretState: "dropped" }),
  });
  const entry = diagnostics.record({ component: "scan", event: "scan.finish", fields: { apiToken: "nope", note: "kept" } });
  assert.equal(entry.note, "kept");
  assert.equal(entry.apiToken, undefined);
  assert.deepEqual(entry.renderer, { renderer: "webgl", support: "ready" });
});

test("flush delivers a batch, clears it, and keeps events on delivery failure", async () => {
  const sent = [];
  const storage = new FakeStorage();
  const diagnostics = createDiagnostics({ storage, persistent: new FakeStorage(), now: fakeClock(), send: async (payload) => { sent.push(payload); return { ok: true }; } });
  diagnostics.record({ component: "scan", event: "scan.finish", outcome: "failure" });
  const result = await diagnostics.flush("scan", "op-123");
  assert.equal(result.sent, 1);
  assert.equal(sent[0].op, "op-123");
  assert.equal(sent[0].sessionId, diagnostics.sessionId);
  assert.equal(diagnostics.events().length, 0);

  const failing = createDiagnostics({ storage: new FakeStorage(), persistent: new FakeStorage(), now: fakeClock(), send: async () => { throw new Error("network down"); } });
  failing.record({ component: "scan", event: "scan.finish", outcome: "failure" });
  const failed = await failing.flush("scan");
  assert.equal(failed.sent, 0);
  assert.deepEqual(failing.events().map((entry) => entry.event), ["scan.finish", "diagnostics.flush"]);
  assert.equal(failing.events().at(-1).error.category, "delivery");
});

test("installed handlers record page errors and unhandled rejections", () => {
  const listeners = {};
  const target = { addEventListener: (name, handler) => { (listeners[name] ??= []).push(handler); } };
  const diagnostics = createDiagnostics({ storage: new FakeStorage(), persistent: new FakeStorage(), now: fakeClock() });
  installDiagnostics(diagnostics, target);
  listeners.error[0]({ error: { message: "boom" }, message: "boom" });
  listeners.unhandledrejection[0]({ reason: { message: "later" } });
  listeners.error[0]({ reason: { message: "rejection via error listener" } });
  const events = diagnostics.events();
  assert.deepEqual(events.map((entry) => entry.event), ["page.error", "page.error", "page.error"]);
  assert.deepEqual(events.map((entry) => entry.error.category), ["exception", "unhandled-rejection", "unhandled-rejection"]);
});
