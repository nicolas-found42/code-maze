import test from "node:test";
import assert from "node:assert/strict";
import { createBeadSeating, seatingInput } from "../docs/bead-seating-client.js";

const input = { rails: [], nodes: [{}], baseTop: 37 };
const result = { positions: [[1, 2, 3]], contacts: [{ gap: 0.03, displacement: 2 }] };
function fixture() {
  const workers = [];
  class Worker {
    constructor() { this.terminated = false; workers.push(this); }
    terminate() { this.terminated = true; }
    postMessage(value) { this.input = value; }
  }
  return { workers, client: createBeadSeating(Worker) };
}
test("only numeric pose data is sent to the contact worker", () => {
  const graph = { rails: [{ id: "r", points: [[0, 0, 0], [0, 1, 0]] }], nodes: [{ id: "private-name", preview: "private-code", rail: "r", x: 1, y: 2, z: 3, tangent: [0, 1, 0] }] };
  assert.deepEqual(seatingInput(graph, 37), { baseTop: 37, rails: [{ points: graph.rails[0].points }], nodes: [{ position: [1, 2, 3], tangent: [0, 1, 0], rail: 0 }] });
});
test("rescan cancels work and a late old message cannot modify the next result", async () => {
  const { client, workers } = fixture();
  const old = client.run(input), next = client.run(input);
  assert.equal(await old, null); assert.equal(workers[0].terminated, true);
  workers[0].onmessage({ data: result });
  workers[1].onmessage({ data: result });
  assert.deepEqual(await next, result); assert.equal(workers[1].terminated, true);
});
test("invalid coordinates reject the result rather than corrupting the map", async () => {
  const { client, workers } = fixture(); const pending = client.run(input);
  workers[0].onmessage({ data: { ...result, positions: [[NaN, 2, 3]] } });
  await assert.rejects(pending, /Invalid/); assert.equal(workers[0].terminated, true);
});
test("array-like objects and missing vector components cannot pass result validation", async () => {
  for (const positions of [{ length: 1 }, [new Array(3)], new Array(1)]) {
    const { client, workers } = fixture(); const pending = client.run(input);
    workers[0].onmessage({ data: { ...result, positions } });
    await assert.rejects(pending, /Invalid/);
  }
});
test("worker errors and deadlines settle and release the owned worker", async t => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const { client, workers } = fixture();
  const failed = client.run(input); workers[0].onerror({ preventDefault() {} });
  await assert.rejects(failed, /unavailable/); assert.equal(workers[0].terminated, true);
  const pending = client.run(input); t.mock.timers.tick(180000);
  await assert.rejects(pending, /deadline/); assert.equal(workers[1].terminated, true);
});
