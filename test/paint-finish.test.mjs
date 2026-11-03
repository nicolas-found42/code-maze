import test from "node:test";
import assert from "node:assert/strict";
import { createPaintFinish, PAINT_REPEAT } from "../docs/paint-finish.js";

test("paint normals encode the physical periodic height slopes, independently of roughness", () => {
  const { size, heights, normal, roughness } = createPaintFinish();
  const pitch = PAINT_REPEAT / size;
  let squaredHeight = 0, squaredSlope = 0;
  const at = (x, y) => heights[((y + size) % size) * size + (x + size) % size];
  // Include both periodic boundaries and interior samples; decode normals
  // independently rather than comparing the generator to its own helper.
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const i = y * size + x, offset = i * 4;
    const dx = (at(x - 1, y) - at(x + 1, y)) / (2 * pitch);
    const dy = (at(x, y + 1) - at(x, y - 1)) / (2 * pitch);
    const nz = normal[offset + 2] / 127.5 - 1;
    assert.ok(Math.abs((normal[offset] / 127.5 - 1) / nz - dx) < 0.009);
    assert.ok(Math.abs((normal[offset + 1] / 127.5 - 1) / nz - dy) < 0.009);
    assert.equal(normal[offset + 3], 255);
    assert.ok(roughness[offset] >= 207 && roughness[offset] <= 231);
    squaredHeight += heights[i] ** 2; squaredSlope += dx ** 2 + dy ** 2;
  }
  const rmsHeight = Math.sqrt(squaredHeight / heights.length);
  const rmsSlope = Math.sqrt(squaredSlope / heights.length);
  assert.ok(rmsHeight > 0.015 && rmsHeight < 0.025, "authored height stays at tens of micrometres");
  assert.ok(rmsSlope > 0.04 && rmsSlope < 0.06, "bounded slopes avoid an exaggerated pebbled surface");
  assert.deepEqual(createPaintFinish().normal, normal, "scene rebuilding retains the same finish");
});
