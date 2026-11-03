import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { StaticGeometryGenerator } from "three-gpu-pathtracer/src/core/utils/StaticGeometryGenerator.js";
import { createBeadGeometries, createBoardGeometry } from "../docs/bead-geometry.js";

test("painted geometry retains an orthonormal shared tangent basis through actual tracer preparation", () => {
  const board = createBoardGeometry(THREE, 200, 180);
  assert.deepEqual([...board.index.array], Array.from({ length: board.attributes.position.count }, (_, i) => i));
  for (const geometry of [...createBeadGeometries(THREE), board]) {
    const original = geometry.attributes.tangent;
    assert.ok(original, "raster rendering must not fall back to a different derivative frame");
    const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ normalMap: new THREE.Texture() }));
    mesh.rotation.set(0.3, -0.6, 1.1); mesh.scale.setScalar(0.001); mesh.updateMatrixWorld(true);
    const { geometry: prepared } = new StaticGeometryGenerator(mesh).generate();
    const actual = prepared.attributes.tangent, n = prepared.attributes.normal;
    assert.equal(actual.count, original.count);
    for (let i = 0; i < actual.count; i++) {
      const expected = new THREE.Vector3().fromBufferAttribute(original, i).transformDirection(mesh.matrixWorld);
      const observed = new THREE.Vector3().fromBufferAttribute(actual, i);
      assert.ok([...observed].every(Number.isFinite));
      assert.ok(Math.abs(observed.length() - 1) < 1e-6);
      assert.ok(Math.abs(observed.dot(new THREE.Vector3().fromBufferAttribute(n, i).normalize())) < 1e-6);
      assert.ok(observed.distanceTo(expected) < 1e-6, "tracer preserves the shared authored basis under toy transforms");
      assert.equal(actual.getW(i), original.getW(i));
      assert.equal(Math.abs(actual.getW(i)), 1);
    }
    prepared.dispose(); geometry.dispose(); mesh.material.normalMap.dispose(); mesh.material.dispose();
  }
});
