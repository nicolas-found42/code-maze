import test from "node:test";
import assert from "node:assert/strict";
import { createBeadSeating, seatingInput, seatingCategory } from "../docs/bead-seating-client.js";

const GRAPH = {
  rails: [{ id: "rail-a", points: [[0, 0, 0], [10, 0, 0]] }],
  nodes: [{ id: "a.js", x: 2, y: 0, z: 0, tangent: [1, 0, 0], rail: "rail-a" }],
};
const INPUT = seatingInput(GRAPH, 0);
const VALID_RESULT = { positions: [[2, 0.5, 0]], contacts: [{ gap: 0.02, displacement: 0.5 }] };

class FakeWorker {
  constructor() {
    FakeWorker.latest = this;
    this.terminated = false;
  }
  postMessage() {
    // Real workers answer asynchronously; defer so tests can install the
    // reply hook after calling run().
    setTimeout(() => FakeWorker.onPost?.(this), 0);
  }
  terminate() { this.terminated = true; }
  reply(data) { this.onmessage({ data }); }
}

function freshWorker() {
  FakeWorker.onPost = undefined;
  FakeWorker.latest = undefined;
  return FakeWorker;
}

test("deadline exceeded rejects and classifies as timeout", async () => {
  const seating = createBeadSeating(FakeWorker, { deadlineMs: 20 });
  await assert.rejects(seating.run(INPUT), /deadline exceeded/);
  assert.equal(seatingCategory(new Error("Toy contact deadline exceeded")), "timeout");
});

test("worker construction failure surfaces the constructor error", async () => {
  class BrokenWorker { constructor() { throw new Error("Web Workers unavailable in this context"); } }
  const seating = createBeadSeating(BrokenWorker);
  await assert.rejects(seating.run(INPUT), /Web Workers unavailable/);
  assert.equal(seatingCategory(new Error("Web Workers unavailable in this context")), "worker-unavailable");
});

test("worker error and message-protocol errors classify distinctly", async () => {
  const failing = createBeadSeating(FakeWorker);
  const failure = failing.run(INPUT);
  FakeWorker.latest.onerror?.({});
  await assert.rejects(failure, /worker unavailable/);
  assert.equal(seatingCategory(new Error("Toy contact worker unavailable")), "worker-unavailable");

  const garbled = createBeadSeating(FakeWorker);
  const garbledRun = garbled.run(INPUT);
  FakeWorker.latest.onmessageerror?.();
  await assert.rejects(garbledRun, /result unavailable/);
  assert.equal(seatingCategory(new Error("Toy contact result unavailable")), "message-protocol");
});

test("malformed results reject as invalid-result", async () => {
  freshWorker();
  FakeWorker.onPost = (worker) => worker.reply({ positions: [], contacts: [] });
  const seating = createBeadSeating(FakeWorker);
  await assert.rejects(seating.run(INPUT), /Invalid toy contact result/);
  assert.equal(seatingCategory(new Error("Invalid toy contact result")), "invalid-result");
});

test("valid results resolve and unknown errors fall back to error", async () => {
  freshWorker();
  FakeWorker.onPost = (worker) => worker.reply(VALID_RESULT);
  const seating = createBeadSeating(FakeWorker);
  assert.deepEqual(await seating.run(INPUT), VALID_RESULT);
  assert.equal(seatingCategory(new Error("something else")), "error");
});

test("a new run supersedes the previous one, which settles as canceled", async () => {
  freshWorker();
  FakeWorker.onPost = (worker) => worker.reply(VALID_RESULT);
  const seating = createBeadSeating(FakeWorker, { deadlineMs: 500 });
  const first = seating.run(INPUT);
  const second = seating.run(INPUT);
  assert.equal(await first, null, "superseded run settles null so the scene can record a canceled outcome");
  assert.deepEqual(await second, VALID_RESULT);
  assert.equal(FakeWorker.latest.terminated, true, "finished workers are torn down");
});

test("empty node sets skip the worker entirely", async () => {
  freshWorker();
  const seating = createBeadSeating(FakeWorker);
  const result = await seating.run(seatingInput({ rails: [], nodes: [] }, 0));
  assert.deepEqual(result, { positions: [], contacts: [] });
  assert.equal(FakeWorker.latest, undefined);
});
