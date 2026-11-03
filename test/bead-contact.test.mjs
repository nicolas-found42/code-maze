import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { ExtendedTriangle } from "three-mesh-bvh";
import { triangleContact } from "../docs/bead-contact.js";

const triangle = (x = 0, y = 0, z = 0) => new THREE.Triangle(
  new THREE.Vector3(x, y, z), new THREE.Vector3(x + 1, y, z), new THREE.Vector3(x, y + 1, z));
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-5, `${actual} != ${expected}`);
test("continuous triangle contact handles approaching, receding and endpoint contacts", () => {
  close(triangleContact(triangle(), triangle(0, 0, 2), new THREE.Vector3(0, 0, -1), 2), 2);
  assert.equal(triangleContact(triangle(), triangle(0, 0, 2), new THREE.Vector3(0, 0, 1), 4), Infinity);
  assert.equal(triangleContact(triangle(), triangle(3, 0, 2), new THREE.Vector3(0, 0, -1), 4), Infinity);
});
test("coplanar and grazing triangles need the in-plane separating axes", () => {
  close(triangleContact(triangle(), triangle(2), new THREE.Vector3(-1, 0, 0), 4), 1);
  close(triangleContact(triangle(), triangle(2, 1), new THREE.Vector3(-1, 0, 0), 4), 2);
  assert.equal(triangleContact(triangle(), triangle(2, 2), new THREE.Vector3(-1, 0, 0), 4), Infinity);
  close(triangleContact(triangle(), triangle(0.1), new THREE.Vector3(1, 0, 0), 4), 0);
});
test("contact times are invariant under a common rigid frame change", () => {
  const rotation = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.3, 0.7, -0.4));
  const matrix = new THREE.Matrix4().compose(new THREE.Vector3(500, -13, 2000), rotation, new THREE.Vector3(1, 1, 1));
  const a = triangle(), b = triangle(0, 0, 2);
  for (const t of [a, b]) for (const p of [t.a, t.b, t.c]) p.applyMatrix4(matrix);
  close(triangleContact(a, b, new THREE.Vector3(0, 0, -1).applyQuaternion(rotation), 4), 2);
});
test("redundant zero-area seams do not produce a phantom surface", () => {
  const seam = new THREE.Triangle(new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3());
  assert.equal(triangleContact(triangle(), seam, new THREE.Vector3(1, 0, 0), 4), Infinity);
});
test("nonparallel contact witnesses agree with the independent triangle-distance implementation", () => {
  let checked = 0;
  for (let i = 1; i <= 40; i++) {
    const a = triangle(), b = triangle(-0.2, -0.2);
    const rotation = new THREE.Quaternion().setFromEuler(new THREE.Euler(i * 0.17, i * 0.11, i * 0.07));
    for (const p of [b.a, b.b, b.c]) p.applyQuaternion(rotation).add(new THREE.Vector3(0, 0, 3));
    const motion = new THREE.Vector3(0, 0, -1), time = triangleContact(a, b, motion, 5);
    if (!Number.isFinite(time)) continue;
    checked++;
    const at = new ExtendedTriangle(...[b.a, b.b, b.c].map(p => p.clone().addScaledVector(motion, time)));
    const other = new ExtendedTriangle(a.a, a.b, a.c);
    assert.ok(at.distanceToTriangle(other) < 1e-4, "TOI has an independently measured contact witness");
  }
  assert.ok(checked > 0, "the comparison includes finite contact witnesses");
});
