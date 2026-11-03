import test from "node:test";
import assert from "node:assert/strict";
import { createPlywoodFinish, PLY_HEIGHT, PLY_LAYERS, PLY_REPEAT, PLY_SIZE } from "../docs/plywood-finish.js";

test("the full plywood stack has bounded independent relief and exactly the declared thickness", () => {
  const photo = { width: 2, height: 2, data: new Uint8ClampedArray(16).fill(220) };
  const a = createPlywoodFinish(photo);
  assert.equal(a.bands.length, PLY_LAYERS);
  assert.equal(a.bands[0].bottom, 0);
  assert.ok(Math.abs(a.bands.at(-1).top - PLY_HEIGHT) < 1e-10);
  assert.equal(a.width, PLY_SIZE); assert.equal(a.height, PLY_SIZE);
  for (const band of a.bands) assert.ok(band.size > 1.4 && band.size < 1.7);
  for (let i = 0; i < a.heights.length; i++) {
    assert.ok(Number.isFinite(a.heights[i]) && Math.abs(a.heights[i]) < 0.01);
    assert.equal(a.color[i * 4 + 3], 255); assert.equal(a.normal[i * 4 + 3], 255);
  }
  for (let x = 0; x < a.width; x++) {
    assert.equal(a.heights[x], 0); assert.equal(a.heights[(a.height - 1) * a.width + x], 0);
  }
  const sample = (x, y) => a.heights[((y + a.height) % a.height) * a.width + (x + a.width) % a.width];
  for (const y of [0, 49, 300, 1023]) for (const x of [0, 17, 320, 1023]) {
    const offset = (y * a.width + x) * 4, z = a.normal[offset + 2] / 127.5 - 1;
    const dx = (sample(x - 1, y) - sample(x + 1, y)) / (2 * PLY_REPEAT / a.width);
    const dy = (sample(x, y + 1) - sample(x, y - 1)) / (2 * PLY_HEIGHT / a.height);
    assert.ok(Math.abs((a.normal[offset] / 127.5 - 1) / z - dx) < 0.009);
    assert.ok(Math.abs((a.normal[offset + 1] / 127.5 - 1) / z - dy) < 0.009);
  }
  photo.data.fill(20);
  const b = createPlywoodFinish(photo);
  assert.deepEqual(a.heights, b.heights, "changing photographic pigment cannot change geometric relief");
  assert.notDeepEqual(a.color, b.color);
});
