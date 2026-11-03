import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import * as THREE from "three";
import { MeshBVH } from "three-mesh-bvh";
import { positionGraph } from "../docs/bead-layout.js";
import { createBeadGeometries } from "../docs/bead-geometry.js";
import { seatBeads } from "../docs/bead-seating.js";
import { seatingInput } from "../docs/bead-seating-client.js";

const shapes = createBeadGeometries(THREE);
for (const shape of shapes) shape.boundsTree = new MeshBVH(shape);
const fixtures = [[30, 3], [240, 3], [600, 3]];
if (process.argv.includes("--large")) fixtures.push([2000, 2], [2000, 3], [2000, 19]);
for (const [count, groups] of fixtures) {
  const ids = Array.from({ length: groups }, (_, i) => `group${i}`);
  const graph = positionGraph({ groups: ids.map(id => ({ id, label: id, color: "#2f6fd6" })),
    nodes: Array.from({ length: count }, (_, i) => ({ id: `f${i}`, group: ids[i % groups] })), edges: [] });
  const start = performance.now(), result = seatBeads(THREE, MeshBVH, seatingInput(graph, 37));
  const solveMs = performance.now() - start;
  assert.equal(result.positions.length, count);
  // Reconstruct the rendered tubes independently of the production helper.
  const rails = graph.rails.map(rail => {
    const curve = new THREE.CatmullRomCurve3(rail.points.map(point => new THREE.Vector3(...point)));
    const geometry = new THREE.TubeGeometry(curve, Math.min(800, Math.max(200, rail.points.length)), 4.8, 16, false);
    return { geometry, tree: new MeshBVH(geometry) };
  });
  const records = graph.nodes.map((node, i) => {
    const shape = shapes[i % shapes.length];
    const center = new THREE.Vector3(...result.positions[i]);
    const matrix = new THREE.Matrix4().compose(center,
      new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(...node.tangent)),
      new THREE.Vector3(1, 1, 1));
    return { shape, matrix, center, inverse: matrix.clone().invert(), bounds: shape.boundingBox.clone().applyMatrix4(matrix) };
  });
  const gaps = [], supportKinds = {};
  for (let i = 0; i < records.length; i++) {
    const { shape, matrix } = records[i], contact = result.contacts[i];
    let low = Infinity;
    for (let j = 0; j < shape.attributes.position.count; j++) low = Math.min(low,
      new THREE.Vector3().fromBufferAttribute(shape.attributes.position, j).applyMatrix4(matrix).y);
    assert.ok(low >= 37 - 1e-5, `${graph.nodes[i].id} intersects the wooden base`);
    let gap = low - 37;
    if (contact.kind === "rail") gap = rails[contact.index].tree.closestPointToGeometry(shape, matrix, {}, {}, 0, 0.1)?.distance;
    else if (contact.kind === "bead") {
      const other = records[contact.index], transform = other.inverse.clone().multiply(matrix);
      gap = other.shape.boundsTree.closestPointToGeometry(shape, transform, {}, {}, 0, 0.1)?.distance;
    } else assert.equal(contact.kind, "base");
    assert.ok(Number.isFinite(gap) && gap >= 0 && gap < 0.1, `${graph.nodes[i].id} lacks independently measured support: ${gap}`);
    gaps.push(gap); supportKinds[contact.kind] = (supportKinds[contact.kind] || 0) + 1;
    for (const rail of rails) assert.equal(rail.tree.intersectsGeometry(shape, matrix), false, `${graph.nodes[i].id} clips a wire`);
    for (let j = 0; j < i; j++) {
      const other = records[j];
      const centers = records[i].center.distanceTo(other.center);
      assert.ok(centers > 50, "seating preserves the layout's bead spacing");
      if (other.bounds.intersectsBox(records[i].bounds)) assert.equal(other.shape.boundsTree.intersectsGeometry(shape,
        other.inverse.clone().multiply(matrix)), false, "seated bead shells remain disjoint");
    }
  }
  // The original near-horizontal, unsupported block now reaches its own wire.
  if (count === 30) {
    const i = graph.nodes.findIndex(node => node.id === "f5");
    assert.equal(result.contacts[i].kind, "rail");
    assert.equal(result.contacts[i].index, graph.rails.findIndex(rail => rail.id === graph.nodes[i].rail));
    assert.ok(gaps[i] < 0.1);
  }
  console.log(JSON.stringify({ count, groups, solveMs, maximumMeasuredGap: Math.max(...gaps), supportKinds,
    validation: "independent actual triangles, all wires/bead pairs/base, original block case, node count and spacing" }));
  for (const rail of rails) rail.geometry.dispose();
}
for (const shape of shapes) shape.dispose();
console.log("Contact geometry passed. These are constrained near-contact authoring poses, not a dynamics or photographic-equivalence certificate.");
