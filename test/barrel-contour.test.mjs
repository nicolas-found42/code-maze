import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { createBeadGeometries } from "../docs/bead-geometry.js";

test("the turned barrel has a rounded outline within its envelope and retains the drilled bore", () => {
  const shapes = createBeadGeometries(THREE), barrel = shapes[2];
  try {
    const { points, segments } = barrel.parameters;
    const paintedSegments = barrel.groups.find(group => group.materialIndex === 0).count / (segments * 6);
    const outside = points.slice(0, paintedSegments + 1);
    let maximumTurn = 0;
    for (let i = 1; i < outside.length - 1; i++) {
      const incoming = outside[i].clone().sub(outside[i - 1]).normalize();
      const outgoing = outside[i + 1].clone().sub(outside[i]).normalize();
      maximumTurn = Math.max(maximumTurn, Math.acos(THREE.MathUtils.clamp(incoming.dot(outgoing), -1, 1)));
    }
    assert.ok(maximumTurn < THREE.MathUtils.degToRad(10), "large meridian corners remain visible despite smooth normals");
    for (const point of outside) {
      assert.ok(point.x >= 8 && point.x <= 24.2);
      assert.ok(Math.abs(point.y) <= 18);
      assert.ok(point.length() < 27, "the existing layout clearance envelope contains the refined surface");
    }
    assert.deepEqual(outside[0].toArray(), [8, 18]);
    assert.deepEqual(points.slice(paintedSegments).map(point => point.toArray()),
      [[8, -18], [7, -17], [7, 17], [8, 18]], "paint ends at the original lip; the bare bore and chamfers retain their dimensions");
    assert.equal(barrel.groups.reduce((sum, group) => sum + group.count, 0), barrel.index.count);
  } finally {
    for (const geometry of shapes) geometry.dispose();
  }
});
