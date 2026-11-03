import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { createBeadGeometries, mapBoardUVs } from "../docs/bead-geometry.js";

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

test("veneer thickness and face grain keep world scale across board sizes", () => {
  for (const size of [700, 1600]) {
    const shape = new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(size, 0), new THREE.Vector2(size, 650), new THREE.Vector2(0, 650)]);
    const geometry = new THREE.ExtrudeGeometry(shape, { depth: 26, bevelEnabled: false });
    geometry.rotateX(-Math.PI / 2);
    mapBoardUVs(geometry);
    const position = geometry.attributes.position, uv = geometry.attributes.uv;
    for (const group of geometry.groups) for (let i = group.start; i < group.start + group.count; i++) {
      assert.ok(Math.abs(uv.getY(i) - (group.materialIndex === 0 ? -position.getZ(i) / 420 : position.getY(i) / 3.25)) < 0.001);
    }
  }
});
