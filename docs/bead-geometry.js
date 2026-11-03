import blockData from "./vendor/bead-block.js";
import { PAINT_REPEAT } from "./paint-finish.js";
import { PLY_HEIGHT, PLY_REPEAT } from "./plywood-finish.js";

const COATING_REPEAT = PAINT_REPEAT;

function finishTangents(geometry) {
  // The raster viewer/normal guide and tracer must use the same authored
  // basis, rather than derivative frames in one and computed tangents in the
  // other. ExtrudeGeometry is nonindexed; an identity index preserves draws.
  if (!geometry.index) geometry.setIndex(Array.from({ length: geometry.attributes.position.count }, (_, i) => i));
  geometry.computeTangents();
  // r160's lathe join normals need not be unit length. computeTangents assumes
  // they are; orthogonalize against the normalized shading direction while
  // retaining the original geometry/normal buffers and UV handedness.
  const normals = geometry.attributes.normal, tangents = geometry.attributes.tangent;
  for (let i = 0; i < tangents.count; i++) {
    const nx = normals.getX(i), ny = normals.getY(i), nz = normals.getZ(i);
    const squared = nx * nx + ny * ny + nz * nz;
    let x = tangents.getX(i), y = tangents.getY(i), z = tangents.getZ(i);
    const projection = (x * nx + y * ny + z * nz) / squared;
    x -= nx * projection; y -= ny * projection; z -= nz * projection;
    const length = Math.hypot(x, y, z);
    tangents.setXYZ(i, x / length, y / length, z / length);
  }
  return geometry;
}

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
    return finishTangents(geometry);
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
  finishTangents(block);
  return [turned(sphere, 32), block, turned(barrel, 12), ringGeometry, turned(spool, 15)];
}

export function createBoardGeometry(THREE, width, depth) {
  const shape = new THREE.Shape();
  const w = width / 2, d = depth / 2, r = 32;
  shape.moveTo(-w + r, -d); shape.lineTo(w - r, -d); shape.quadraticCurveTo(w, -d, w, -d + r);
  shape.lineTo(w, d - r); shape.quadraticCurveTo(w, d, w - r, d); shape.lineTo(-w + r, d);
  shape.quadraticCurveTo(-w, d, -w, d - r); shape.lineTo(-w, -d + r); shape.quadraticCurveTo(-w, -d, -w + r, -d);
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: PLY_HEIGHT - 6, bevelEnabled: true, bevelSize: 4, bevelThickness: 3, bevelSegments: 4, curveSegments: 14 });
  geometry.rotateX(-Math.PI / 2);
  const outline = shape.getPoints(14).map(point => ({ x: point.x, z: -point.y }));
  if (Math.hypot(outline[0].x - outline.at(-1).x, outline[0].z - outline.at(-1).z) < 1e-6) outline.pop();
  mapBoardUVs(geometry, outline);
  return geometry;
}

// Project side vertices onto the actual sampled outline, including the bevel
// offsets. Whole perimeter repeats close the texture phase at the chart seam.
function mapBoardUVs(geometry, outline) {
  const segments = [];
  let perimeter = 0;
  for (let i = 0; i < outline.length; i++) {
    const a = outline[i], b = outline[(i + 1) % outline.length];
    const dx = b.x - a.x, dz = b.z - a.z, length = Math.hypot(dx, dz);
    if (length === 0) continue;
    segments.push({ a, dx, dz, length, start: perimeter }); perimeter += length;
  }
  const turns = Math.max(1, Math.round(perimeter / PLY_REPEAT));
  function edgeU(x, z) {
    let closest = Infinity, along = 0;
    for (const segment of segments) {
      const { a, dx, dz, length, start } = segment;
      const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / (length * length)));
      const distance = (x - a.x - dx * t) ** 2 + (z - a.z - dz * t) ** 2;
      if (distance < closest) { closest = distance; along = start + t * length; }
    }
    return along / perimeter * turns;
  }
  const position = geometry.getAttribute("position"), uv = geometry.getAttribute("uv");
  for (const group of geometry.groups) for (let i = group.start; i < group.start + group.count; i++) {
    const x = position.getX(i), y = position.getY(i), z = position.getZ(i);
    uv.setXY(i, group.materialIndex === 0 ? x / 420 : edgeU(x, z),
      group.materialIndex === 0 ? -z / 420 : (y + 3) / PLY_HEIGHT);
  }
  for (const group of geometry.groups.filter(g => g.materialIndex === 1)) for (let i = group.start; i < group.start + group.count; i += 3) {
    const values = [0, 1, 2].map(j => uv.getX(i + j));
    if (Math.max(...values) - Math.min(...values) > turns / 2) {
      for (let j = 0; j < 3; j++) if (values[j] < turns / 2) uv.setX(i + j, values[j] + turns);
    }
  }
  uv.needsUpdate = true;
  finishTangents(geometry);
}
