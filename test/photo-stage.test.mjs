import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { createPhotoStage } from "../docs/photo-stage.js";

test("the studio sweep provides continuous inward-facing ground across the horizon in every azimuth", () => {
  const center = new THREE.Vector3(2, 4, -3), ground = -0.5;
  const stage = createPhotoStage(THREE, 1, center, ground);
  stage.updateMatrixWorld();
  const ray = new THREE.Raycaster();
  const origin = new THREE.Vector3(center.x, ground + 1, center.z);
  for (let azimuth = 0; azimuth < Math.PI * 2; azimuth += Math.PI / 7) {
    const hits = [];
    for (const slope of [-0.005, 0, 0.005, 0.35]) {
      ray.set(origin, new THREE.Vector3(Math.cos(azimuth), slope, Math.sin(azimuth)).normalize());
      const hit = ray.intersectObject(stage)[0];
      assert.ok(hit, "low camera rays must see a surface rather than a floor/sky boundary");
      assert.ok(hit.face.normal.dot(ray.ray.direction) < 0, "surface faces the interior of the studio");
      hits.push(hit);
    }
    assert.ok(Math.abs(hits[2].distance - hits[0].distance) < 0.3, "surface depth is continuous through the geometric horizon");
  }
  ray.set(origin, new THREE.Vector3(0, -1, 0));
  const contact = ray.intersectObject(stage)[0];
  assert.ok(Math.abs(contact.point.y - ground) < 1e-6, "flat contact floor retains its actual world height");
  assert.ok(contact.face.normal.y > 0.999);
  stage.geometry.dispose(); stage.material.dispose();
});
