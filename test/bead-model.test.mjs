import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import * as THREE from "three";
import { createBeadGeometries, createBoardGeometry } from "../docs/bead-geometry.js";

const geometries = createBeadGeometries(THREE);
for (const [index, geometry] of geometries.entries()) {
  test(`bead ${index}: open drill, outward shell and layout clearance`, () => {
    const materials = [new THREE.MeshBasicMaterial(), new THREE.MeshBasicMaterial()];
    const mesh = new THREE.Mesh(geometry, materials);
    mesh.updateMatrixWorld();
    const ray = new THREE.Raycaster();
    // Both directions, and off-centre rays, detect accidental bore caps.
    for (const y of [-60, 60]) for (const x of [0, 6.5]) {
      ray.set(new THREE.Vector3(x, y, 0), new THREE.Vector3(0, -Math.sign(y), 0));
      assert.equal(ray.intersectObject(mesh).length, 0, "drill axis must remain open");
    }
    for (const angle of [0, 0.7, 1.9, 3.2, 4.7]) {
      const origin = new THREE.Vector3(Math.cos(angle) * 60, 0, Math.sin(angle) * 60);
      ray.set(origin, origin.clone().normalize().negate());
      const hit = ray.intersectObject(mesh)[0];
      assert.ok(hit && hit.distance < 46, "near exterior must face the viewer, not disappear as an inside-out shell");
      assert.ok(hit.face.normal.dot(hit.point) > 0, "near exterior normal points out");
    }
    const position = geometry.attributes.position;
    for (let i = 0; i < position.count; i++) {
      assert.ok(Math.hypot(position.getX(i), position.getY(i), position.getZ(i)) <= 27.001,
        "geometry stays within layout's bead envelope");
    }
    assert.ok(geometry.groups.some((group) => group.materialIndex === 1 && group.count > 0), "bore has its own timber material");
    // Geometric winding, not just interpolated normals: a reversed triangle
    // would be culled even if its vertex normals were manually corrected.
    for (let i = 0; i < geometry.index.count; i += 3) {
      const points = [0, 1, 2].map((offset) => new THREE.Vector3().fromBufferAttribute(position, geometry.index.getX(i + offset)));
      const center = points.reduce((sum, point) => sum.add(point), new THREE.Vector3()).divideScalar(3);
      if (Math.hypot(center.x, center.z) < (index === 3 ? 17 : 14)) continue;
      const normal = points[1].clone().sub(points[0]).cross(points[2].clone().sub(points[0]));
      assert.ok(normal.x * center.x + normal.z * center.z >= -0.002, "outer triangle winding faces outward");
    }
  });
}

test("full-stack board charts close around the perimeter without changing physical geometry", () => {
  // Captured from the former inline construction at50c57a2, before moving it.
  const cases = [[180, 180, "35dad9f903a80492659ac9398064442497b95838dd860b5866f9b616a2f25f6a"],
    [700, 650, "eb8fe6b94d5678531cf57ad9bcd0ce6857af9ee4e5e1176a0951aaa32d182b79"],
    [1600, 900, "5e45e54dd84b4e1de121c626e949a11505d9666c689d1759d233960a8e3aea84"]];
  for (const [width, depth, expected] of cases) {
    const geometry = createBoardGeometry(THREE, width, depth);
    const hash = createHash("sha256");
    for (const key of ["position", "normal"]) {
      const data = geometry.attributes[key].array;
      hash.update(Buffer.from(data.buffer, data.byteOffset, data.byteLength));
    }
    hash.update(JSON.stringify(geometry.groups)); assert.equal(hash.digest("hex"), expected);
    const position = geometry.attributes.position, uv = geometry.attributes.uv;
    const seams = new Map(); let closedSeam = false;
    for (const group of geometry.groups) for (let i = group.start; i < group.start + group.count; i++) {
      assert.ok(Math.abs(uv.getY(i) - (group.materialIndex === 0 ? -position.getZ(i) / 420 : (position.getY(i) + 3) / 32)) < 1e-6);
      if (group.materialIndex !== 1) continue;
      assert.ok(uv.getY(i) >= 0 && uv.getY(i) <= 1);
      const key = [position.getX(i), position.getY(i), position.getZ(i)].join(","), previous = seams.get(key);
      if (previous !== undefined) {
        const difference = uv.getX(i) - previous;
        assert.ok(Math.abs(difference - Math.round(difference)) < 1e-5, "duplicate seam positions retain texture phase");
        if (Math.abs(difference) > 0.99) closedSeam = true;
      }
      seams.set(key, uv.getX(i));
    }
    assert.ok(closedSeam, "the perimeter chart actually unwraps and closes at a seam");
    assert.deepEqual([...geometry.index.array], Array.from({ length: position.count }, (_, i) => i));
    geometry.dispose();
  }
});
