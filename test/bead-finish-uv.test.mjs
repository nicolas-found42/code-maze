import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { createBeadGeometries } from "../docs/bead-geometry.js";

test("the shared coating has comparable physical texture scale on every bead form", () => {
  const scales = createBeadGeometries(THREE).map(geometry => {
    const { position, uv } = geometry.attributes, samples = [];
    if (geometry.parameters?.points) {
      const rows = geometry.parameters.points.length;
      for (let j = 0; j < rows; j++) {
        const end = position.count - rows + j;
        const repeats = uv.getX(end) - uv.getX(j);
        assert.ok(Math.abs(repeats - Math.round(repeats)) < 1e-6, "closed azimuth must meet at the same texture phase");
        assert.equal(uv.getY(end), uv.getY(j));
      }
    }
    for (const group of geometry.groups.filter(group => group.materialIndex === 0)) {
      for (let i = group.start; i < group.start + group.count; i += 3) {
        const indices = [0, 1, 2].map(j => geometry.index.getX(i + j));
        const p = indices.map(j => new THREE.Vector3().fromBufferAttribute(position, j));
        const t = indices.map(j => new THREE.Vector2().fromBufferAttribute(uv, j));
        const area = p[1].clone().sub(p[0]).cross(p[2].clone().sub(p[0])).length();
        const a = t[1].clone().sub(t[0]), b = t[2].clone().sub(t[0]);
        const textureArea = Math.abs(a.x * b.y - a.y * b.x);
        if (area > 1e-6 && textureArea > 1e-9) samples.push({ area, scale: Math.sqrt(area / textureArea) });
      }
    }
    samples.sort((a, b) => a.scale - b.scale);
    const half = samples.reduce((sum, sample) => sum + sample.area, 0) / 2;
    let cumulative = 0;
    const median = samples.find(sample => (cumulative += sample.area) >= half).scale;
    assert.ok(median >= 26 && median <= 36, `32 mm coating repeat has surface scale ${median}`);
    return median;
  });
  assert.ok(Math.max(...scales) / Math.min(...scales) < 1.25, `one finish cannot stretch threefold between forms: ${scales}`);
});
