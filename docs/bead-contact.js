// Fixed-orientation continuous SAT. See the independent derivation and primary
// source in bead-contact-research.md. Times are distances for unit velocity.
export function triangleContact(a, b, velocity, maximum) {
  const edges = t => [t.b.clone().sub(t.a), t.c.clone().sub(t.b), t.a.clone().sub(t.c)];
  const ea = edges(a), eb = edges(b);
  const na = ea[0].clone().cross(ea[1]), nb = eb[0].clone().cross(eb[1]);
  // Canonical meshes contain redundant zero-area seam triangles, not separate
  // line/point obstacles. They contribute no surface to this contact model.
  if (na.lengthSq() < 1e-18 || nb.lengthSq() < 1e-18) return Infinity;
  const axes = [na, nb, ...ea.flatMap(x => eb.map(y => x.clone().cross(y))),
    ...ea.map(edge => na.clone().cross(edge)), ...eb.map(edge => nb.clone().cross(edge))];
  let enter = 0, exit = maximum;
  for (const axis of axes) {
    if (axis.lengthSq() < 1e-18) continue;
    axis.normalize();
    const pa = [a.a.dot(axis), a.b.dot(axis), a.c.dot(axis)];
    const pb = [b.a.dot(axis), b.b.dot(axis), b.c.dot(axis)];
    const loA = Math.min(...pa), hiA = Math.max(...pa), loB = Math.min(...pb), hiB = Math.max(...pb);
    const speed = velocity.dot(axis);
    if (Math.abs(speed) < 1e-12) {
      if (loB > hiA + 1e-7 || loA > hiB + 1e-7) return Infinity;
      continue;
    }
    const t0 = (loA - hiB - 1e-7) / speed, t1 = (hiA - loB + 1e-7) / speed;
    enter = Math.max(enter, Math.min(t0, t1));
    exit = Math.min(exit, Math.max(t0, t1));
    if (enter > exit) return Infinity;
  }
  return enter;
}

// All geometry and transforms use the obstacle BVH's frame. Only rigid unit-
// scale transforms are supported. Broad-phase boxes include the entire sweep.
export function meshContact(THREE, obstacle, shape, transform, direction, maximum) {
  const inverse = transform.clone().invert();
  const velocity = direction.clone().transformDirection(inverse).negate();
  if (!shape.boundingBox) shape.computeBoundingBox();
  const bounds = shape.boundingBox.clone().applyMatrix4(transform);
  bounds.union(bounds.clone().translate(direction.clone().multiplyScalar(maximum)));
  let first = maximum, found = false, pairs = 0;
  obstacle.shapecast({
    intersectsBounds: box => box.intersectsBox(bounds),
    intersectsTriangle(triangle) {
      const moving = new THREE.Triangle(triangle.a.clone().applyMatrix4(inverse),
        triangle.b.clone().applyMatrix4(inverse), triangle.c.clone().applyMatrix4(inverse));
      const box = new THREE.Box3().setFromPoints([moving.a, moving.b, moving.c]);
      box.union(box.clone().translate(velocity.clone().multiplyScalar(first)));
      shape.boundsTree.shapecast({
        intersectsBounds: candidate => candidate.intersectsBox(box),
        intersectsTriangle(bead) {
          pairs++;
          const distance = triangleContact(bead, moving, velocity, first);
          if (distance <= first) { first = distance; found = true; }
          return false;
        },
      });
      return false;
    },
  });
  return { distance: found ? first : Infinity, pairs };
}
