import blockData from "./vendor/bead-block.js";

const COATING_REPEAT = 32; // Layout millimetres; one shared fine-finish tile.

export function createSupportGeometry(THREE, rail) {
  const curve = new THREE.CatmullRomCurve3(rail.points.map(point => new THREE.Vector3(...point)));
  return new THREE.TubeGeometry(curve, Math.min(800, Math.max(200, rail.points.length)), 4.8, 16, false);
}

// All shapes fit inside the layout's radius-27 clearance envelope. Local +Y is
// the drill axis, aligned to the track tangent by bead-scene.
export function createBeadGeometries(THREE) {
  function turned(profile, paintedSegments) {
    const segments = 64;
    const geometry = new THREE.LatheGeometry(profile.map(([x, y]) => new THREE.Vector2(x, y)), segments);
    // Normalized Lathe UVs stretch the same finish over the entire bead and
    // give every profile segment equal texture space regardless of its length.
    // Use meridian distances and a whole number of tiles around the widest
    // ring, preserving a seamless azimuth with approximately 32 mm repeats.
    const arc = [0];
    for (let j = 1; j < profile.length; j++) arc.push(arc[j - 1] + Math.hypot(profile[j][0] - profile[j - 1][0], profile[j][1] - profile[j - 1][1]));
    const turns = Math.max(1, Math.round(2 * Math.PI * Math.max(...profile.map(point => point[0])) / COATING_REPEAT));
    const uv = geometry.attributes.uv;
    for (let i = 0; i <= segments; i++) for (let j = 0; j < profile.length; j++) {
      uv.setXY(i * profile.length + j, i / segments * turns, arc[j] / COATING_REPEAT);
    }
    // Partition triangles into two draws: enamel outside, raw timber in the bore.
    const paint = [], timber = [], index = geometry.index.array;
    for (let i = 0; i < segments; i++) for (let j = 0; j < profile.length - 1; j++) {
      const offset = (i * (profile.length - 1) + j) * 6;
      (j < paintedSegments ? paint : timber).push(...index.slice(offset, offset + 6));
    }
    const indices = [...paint, ...timber];
    const area = profile.reduce((sum, point, i) => {
      const next = profile[(i + 1) % profile.length];
      return sum + point[0] * next[1] - next[0] * point[1];
    }, 0);
    // LatheGeometry expects a counterclockwise profile. Top-to-bottom outer
    // profiles otherwise produce inside-out shells with invisible near faces.
    if (area < 0) {
      for (let i = 0; i < indices.length; i += 3) [indices[i + 1], indices[i + 2]] = [indices[i + 2], indices[i + 1]];
      const normals = geometry.getAttribute("normal");
      for (let i = 0; i < normals.count; i++) normals.setXYZ(i, -normals.getX(i), -normals.getY(i), -normals.getZ(i));
    }
    geometry.setIndex(indices);
    geometry.clearGroups();
    geometry.addGroup(0, paint.length, 0);
    geometry.addGroup(paint.length, timber.length, 1);
    return geometry;
  }
  const sphere = [];
  for (let i = 0; i <= 32; i++) {
    const a = 0.35 + (Math.PI - 0.7) * i / 32;
    sphere.push([23 * Math.sin(a), 23 * Math.cos(a)]);
  }
  sphere.push([7.1, -21], [7, -20.2], [7, 20.2], [7.1, 21], sphere[0]);
  const barrel = [[8,18], [13,18], [18,17.7], [21,16.3], [23,13], [24,7], [24.2,0], [24,-7], [23,-13], [21,-16.3], [18,-17.7], [13,-18], [8,-18], [7,-17], [7,17], [8,18]];
  const ring = [];
  for (let i = 0; i <= 40; i++) {
    const a = -Math.PI / 2 + i / 40 * Math.PI * 2;
    ring.push([16 + 9 * Math.cos(a), 9 * Math.sin(a)]);
  }
  // Inner half of the toroid is bare wood, including a clearly visible bore.
  const ringGeometry = turned(ring, 20);
  const spool = [[8,17],[18,17],[21,16.5],[22,15],[22,12],[21,10],[17,9],[16,7],[16,-7],[17,-9],[21,-10],[22,-12],[22,-15],[21,-16.5],[18,-17],[8,-17],[7,-16],[7,16],[8,17]];
  const block = new THREE.BufferGeometry();
  for (const [name, values] of Object.entries(blockData.attributes)) block.setAttribute(name, new THREE.Float32BufferAttribute(values, name === "uv" ? 2 : 3));
  // RoundedBoxGeometry's native face tile spans roughly 30 mm. Retain its
  // chart seams and bevel mapping, with at most 32/30 face aspect variation.
  const blockUV = block.attributes.uv;
  for (let i = 0; i < blockUV.count; i++) blockUV.setXY(i, blockUV.getX(i) * 30 / COATING_REPEAT, blockUV.getY(i) * 30 / COATING_REPEAT);
  block.setIndex(blockData.index);
  for (const group of blockData.groups) block.addGroup(group.start, group.count, group.materialIndex);
  return [turned(sphere, 32), block, turned(barrel, 12), ringGeometry, turned(spool, 15)];
}

// ExtrudeGeometry's default world-space UVs are unsuitable for a plywood edge.
// Use real distances: one grain tile spans 420 units, one veneer spans 3.25.
export function mapBoardUVs(geometry) {
  const position = geometry.getAttribute("position"), uv = geometry.getAttribute("uv");
  for (const group of geometry.groups) for (let i = group.start; i < group.start + group.count; i++) {
    const x = position.getX(i), y = position.getY(i), z = position.getZ(i);
    uv.setXY(i, group.materialIndex === 0 ? x / 420 : (x + z) / 420,
      group.materialIndex === 0 ? -z / 420 : y / 3.25);
  }
  uv.needsUpdate = true;
}
