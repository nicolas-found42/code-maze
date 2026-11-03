import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { MeshBVH } from 'three-mesh-bvh';
import { positionGraph } from '../docs/bead-layout.js';
import { createBeadGeometries } from '../docs/bead-geometry.js';

const shapes = createBeadGeometries(THREE);
// Both sides need acceleration; otherwise each tube leaf brute-forces every
// bead triangle, making the 600-node regression needlessly expensive.
for (const geometry of shapes) geometry.boundsTree = new MeshBVH(geometry);
for (const count of [30, 240, 600]) test(`${count} actual bead shells clear their own curved support tubes`, () => {
  const ids = ['src', 'docs', 'test'];
  const graph = positionGraph({
    groups: ids.map(id => ({ id, label: id, color: '#2f6fd6' })),
    nodes: Array.from({ length: count }, (_, i) => ({ id: `f${i}`, label: `f${i}`, group: ids[i % ids.length] })), edges: [],
  });
  assert.equal(graph.nodes.length, count);
  const rails = new Map(graph.rails.map(rail => {
    const curve = new THREE.CatmullRomCurve3(rail.points.map(point => new THREE.Vector3(...point)));
    const tube = new THREE.TubeGeometry(curve, Math.min(800, Math.max(200, rail.points.length)), 4.8, 16, false);
    return [rail.id, new MeshBVH(tube)];
  }));
  for (const [index, node] of graph.nodes.entries()) {
    const rotation = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(...node.tangent));
    const placement = new THREE.Matrix4().compose(new THREE.Vector3(node.x, node.y, node.z), rotation, new THREE.Vector3(1, 1, 1));
    assert.equal(rails.get(node.rail).intersectsGeometry(shapes[index % shapes.length], placement), false,
      `${node.id} on ${node.rail}: timber clips its own support tube`);
  }
});
