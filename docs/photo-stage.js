// A surrounding studio sweep keeps low-angle photographs off a floor/sky
// horizon. The broad flat region preserves the toy's contact shadows; the
// quarter-circle upturn and tall wall stay outside the orbitable subject.
export function createPhotoStage(THREE, span, center, ground) {
  const profile = [new THREE.Vector2(span * 16, span * 24)];
  for (let i = 32; i >= 0; i--) {
    const angle = i / 32 * Math.PI / 2;
    profile.push(new THREE.Vector2(span * (8 + 8 * Math.sin(angle)), span * 8 * (1 - Math.cos(angle))));
  }
  // A radial triangle fan over the subject gives every floor wedge a bounding
  // box touching the toy. Keep the flat part to two triangles for the tracer's
  // BVH, and let its corners continue beneath the raised sweep.
  const flat = new THREE.PlaneGeometry(span * 16, span * 16);
  flat.rotateX(-Math.PI / 2);
  const sweep = new THREE.LatheGeometry(profile, 96);
  const geometry = new THREE.BufferGeometry();
  for (const key of ["position", "normal", "uv"]) {
    const a = flat.getAttribute(key), b = sweep.getAttribute(key);
    const data = new Float32Array(a.array.length + b.array.length);
    data.set(a.array); data.set(b.array, a.array.length);
    geometry.setAttribute(key, new THREE.BufferAttribute(data, a.itemSize));
  }
  geometry.setIndex([...flat.index.array, ...Array.from(sweep.index.array, i => i + flat.attributes.position.count)]);
  flat.dispose(); sweep.dispose();
  const stage = new THREE.Mesh(geometry,
    new THREE.MeshStandardMaterial({ color: 0xf7f4ed, roughness: 0.92 }));
  stage.position.set(center.x, ground, center.z);
  return stage;
}
