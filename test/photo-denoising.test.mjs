import test from "node:test";
import assert from "node:assert/strict";
import { createPhotoDenoising, readLinearImage } from "../docs/photo-denoising.js";

const image = { data: new Float32Array([2, 0.5, 0.25, 1]), width: 1, height: 1 };
const tick = () => new Promise(resolve => setImmediate(resolve));
function fixture() {
  const jobs = [];
  let disposed = 0;
  return {
    jobs, get disposed() { return disposed; },
    execute(input, done, error) { const job = { input, done, error, aborted: false }; jobs.push(job); return () => { job.aborted = true; }; },
    dispose() { disposed++; },
  };
}

test("HDR readback flips rows without clipping highlights or applying gamma", () => {
  const renderer = { readRenderTargetPixels(target, x, y, width, height, output) {
    output.set([0, 0, 1, 1, 0, 1, 0, 1, 4, 0, 0, 1, 0.5, -1, NaN, 1]);
  } };
  const result = readLinearImage(renderer, { width: 2, height: 2 });
  assert.deepEqual([...result.data], [4, 0, 0, 1, 0.5, 0, 0, 1, 0, 0, 1, 1, 0, 1, 0, 1]);
  assert.equal(result.width, 2); assert.equal(result.height, 2);
});

test("half-float guide readback decodes before reordering rows", () => {
  const renderer = { readRenderTargetPixels(target, x, y, width, height, output) {
    assert.ok(output instanceof Uint16Array); output.set([2, 4, 6, 8, 10, 12, 14, 16]);
  } };
  const result = readLinearImage(renderer, { width: 1, height: 2 }, { ArrayType: Uint16Array, decode: value => value / 2 });
  assert.deepEqual([...result.data], [5, 6, 7, 8, 1, 2, 3, 4]);
});

test("a stale network result cannot overwrite a newer camera's photograph", async () => {
  const network = fixture(); const denoiser = createPhotoDenoising(async () => network);
  const old = denoiser.run({ color: image }); await tick();
  const current = denoiser.run({ color: image }); await tick();
  assert.equal(await old, null); assert.equal(network.jobs[0].aborted, true);
  network.jobs[0].done({ ...image, obsolete: true });
  const output = { ...image, current: true }; network.jobs[1].done(output);
  assert.equal(await current, output);
  denoiser.dispose(); assert.equal(network.disposed, 1);
});

test("closing during network initialization disposes the late network without starting a tile", async () => {
  let complete; const network = fixture();
  const denoiser = createPhotoDenoising(() => new Promise(resolve => { complete = resolve; }));
  const pending = denoiser.run({ color: image }); denoiser.dispose(); complete(network);
  assert.equal(await pending, null); await tick();
  assert.equal(network.jobs.length, 0); assert.equal(network.disposed, 1);
});

test("device/execution failure preserves the existing spatial photograph", async () => {
  const network = fixture(); const denoiser = createPhotoDenoising(async () => network);
  const pending = denoiser.run({ color: image }); await tick();
  network.jobs[0].error(new Error("device lost"));
  assert.equal(await pending, null); denoiser.dispose();
});

test("a stalled refinement settles at its deadline and aborts initialization", async t => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  let signal;
  const denoiser = createPhotoDenoising(s => { signal = s; return new Promise(() => {}); });
  const pending = denoiser.run({ color: image });
  t.mock.timers.tick(30000);
  assert.equal(await pending, null); assert.equal(signal.aborted, true);
  denoiser.dispose();
});
