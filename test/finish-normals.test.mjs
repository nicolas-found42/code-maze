import test from "node:test";
import assert from "node:assert/strict";
import { normalsFromHeight } from "../docs/finish-normals.js";

test("paint normals agree with a periodic height field in texture UV space", () => {
  const width = 32, height = 32, strength = 0.6;
  const field = Float32Array.from({ length: width * height }, (_, i) => {
    const x = i % width, row = Math.floor(i / width);
    return 3 * Math.sin(2 * Math.PI * x / width) + 2 * Math.sin(2 * Math.PI * (1 - row / height));
  });
  const map = normalsFromHeight(field, width, height, strength);
  // Analytic derivatives in u/v, not another invocation of the implementation.
  // Central differences scale the exact sine slope by 2*sin(one texel angle).
  const step = 2 * Math.sin(2 * Math.PI / width) * strength;
  for (const row of [0, 5, 12, 31]) for (const x of [0, 3, 16, 31]) {
    const expected = [-3 * step * Math.cos(2 * Math.PI * x / width), -2 * step * Math.cos(2 * Math.PI * (1 - row / height)), 1];
    const length = Math.hypot(...expected);
    const index = (row * width + x) * 4;
    const actual = [...map.slice(index, index + 3)].map(value => value / 127.5 - 1);
    const dot = expected.reduce((sum, value, axis) => sum + value / length * actual[axis], 0) / Math.hypot(...actual);
    assert.ok(dot > 0.9999, `wrong normal at ${x},${row}: ${dot}`);
    assert.equal(map[index + 3], 255);
  }
});
