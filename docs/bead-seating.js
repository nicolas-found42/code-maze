import { createBeadGeometries, createSupportGeometry } from "./bead-geometry.js";
import { meshContact } from "./bead-contact.js";

// Constrained authoring, not a dynamics simulation: rail fractions and rotations
// stay fixed. Every accepted center stops near its first physical obstacle.
export function seatBeads(THREE, MeshBVH, input) {
  const shapes = createBeadGeometries(THREE);
  const rails = input.rails.map(rail => createSupportGeometry(THREE, rail));
  try {
    for (const shape of shapes) shape.boundsTree = new MeshBVH(shape);
    const railTrees = rails.map(geometry => new MeshBVH(geometry));
    const railBounds = railTrees.map(tree => tree.getBoundingBox(new THREE.Box3()));
    const unit = new THREE.Vector3(1, 1, 1), up = new THREE.Vector3(0, 1, 0);
    const records = input.nodes.map((node, i) => {
      const shape = shapes[i % shapes.length];
      const matrix = new THREE.Matrix4().compose(new THREE.Vector3(...node.position),
        new THREE.Quaternion().setFromUnitVectors(up, new THREE.Vector3(...node.tangent)), unit);
      return { shape, matrix, inverse: matrix.clone().invert(), bounds: shape.boundingBox.clone().applyMatrix4(matrix) };
    });
    const positions = [], contacts = [];
    for (let i = 0; i < records.length; i++) {
      const record = records[i], node = input.nodes[i], { shape, matrix } = record;
      const position = new THREE.Vector3().setFromMatrixPosition(matrix);
      const axis = new THREE.Vector3(...node.tangent);
      const direction = new THREE.Vector3(0, -1, 0).addScaledVector(axis, axis.y);
      if (direction.lengthSq() < 1e-12) throw new Error("No radial gravity direction for this pose");
      direction.normalize();
      const own = railTrees[node.rail];
      if (own.intersectsGeometry(shape, matrix)) throw new Error("Initial bore intersects its rail");
      let low = Infinity;
      const points = shape.attributes.position;
      for (let j = 0; j < points.count; j++) low = Math.min(low,
        new THREE.Vector3().fromBufferAttribute(points, j).applyMatrix4(matrix).y);
      if (low < input.baseTop) throw new Error("Initial bead intersects the base");
      const baseDistance = (low - input.baseTop) / -direction.y;
      let limit = Math.min(4.5, baseDistance);
      let support = baseDistance <= 4.5 ? { kind: "base", index: -1 } : null;
      let obstacle, relative, localDirection;
      const swept = record.bounds.clone();
      swept.union(swept.clone().translate(direction.clone().multiplyScalar(limit)));
      for (let j = 0; j < railTrees.length; j++) {
        if (!railBounds[j].intersectsBox(swept)) continue;
        const hit = meshContact(THREE, railTrees[j], shape, matrix, direction, limit);
        if (hit.distance <= limit) {
          limit = hit.distance; support = { kind: "rail", index: j };
          obstacle = railTrees[j]; relative = matrix.clone(); localDirection = direction;
        }
      }
      for (let j = 0; j < records.length; j++) {
        if (j === i || !records[j].bounds.intersectsBox(swept)) continue;
        const inverse = records[j].inverse;
        const transform = inverse.clone().multiply(matrix);
        const motion = direction.clone().transformDirection(inverse);
        const hit = meshContact(THREE, records[j].shape.boundsTree, shape, transform, motion, limit);
        if (hit.distance <= limit) {
          limit = hit.distance; support = { kind: "bead", index: j };
          obstacle = records[j].shape.boundsTree; relative = transform; localDirection = motion;
        }
      }
      if (!support || !Number.isFinite(limit) || limit > 4.5) throw new Error("No bounded support contact");
      let displacement = Math.max(0, limit - 0.03);
      position.addScaledVector(direction, displacement); matrix.setPosition(position);
      let gap = low + direction.y * displacement - input.baseTop;
      if (obstacle) {
        relative.setPosition(new THREE.Vector3().setFromMatrixPosition(relative).addScaledVector(localDirection, displacement));
        // Independently verify the tolerance-expanded SAT result. A grazing
        // early hit may require conservative distance refinement.
        for (let step = 0; step < 24; step++) {
          // A witnessed pair within tolerance proves near-contact without
          // finding the global minimum. Only use a true minimum to advance.
          const hit = obstacle.closestPointToGeometry(shape, relative, {}, {}, 0.08, 0.1) ??
            obstacle.closestPointToGeometry(shape, relative, {}, {}, 0, 4.5);
          if (!hit) throw new Error("Contact distance unavailable");
          gap = hit.distance;
          if (gap < 0.08) break;
          const advance = 0.8 * (gap - 0.03);
          displacement += advance;
          if (displacement > 4.5) throw new Error("Contact refinement exceeded bound");
          position.addScaledVector(direction, advance); matrix.setPosition(position);
          relative.setPosition(new THREE.Vector3().setFromMatrixPosition(relative).addScaledVector(localDirection, advance));
        }
        if (gap >= 0.08 || obstacle.intersectsGeometry(shape, relative)) throw new Error("Invalid support contact");
      }
      if (low + direction.y * displacement < input.baseTop - 1e-5) throw new Error("Seated bead intersects the base");
      record.bounds.copy(shape.boundingBox).applyMatrix4(matrix);
      record.inverse.copy(matrix).invert();
      for (let j = 0; j < railTrees.length; j++) if (railBounds[j].intersectsBox(record.bounds) &&
        railTrees[j].intersectsGeometry(shape, matrix)) throw new Error("Seated bead intersects a rail");
      for (let j = 0; j < records.length; j++) if (j !== i && records[j].bounds.intersectsBox(record.bounds)) {
        const transform = records[j].inverse.clone().multiply(matrix);
        if (records[j].shape.boundsTree.intersectsGeometry(shape, transform)) throw new Error("Seated beads intersect");
      }
      positions.push(position.toArray());
      contacts.push({ ...support, gap, displacement });
    }
    // A later body can move away from an earlier contact. Do not certify that
    // earlier pose from stale witness data.
    for (let i = 0; i < records.length; i++) {
      const contact = contacts[i], record = records[i];
      if (contact.kind !== "bead") continue;
      const other = records[contact.index];
      const transform = other.inverse.clone().multiply(record.matrix);
      const hit = other.shape.boundsTree.closestPointToGeometry(record.shape, transform, {}, {}, 0, 0.1);
      if (!hit || hit.distance >= 0.1) throw new Error("A neighboring support moved away");
      contact.gap = hit.distance;
    }
    return { positions, contacts };
  } finally {
    for (const geometry of [...shapes, ...rails]) geometry.dispose();
  }
}
