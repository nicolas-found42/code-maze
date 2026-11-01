import test from "node:test";
import assert from "node:assert/strict";
import { pointAlong, positionGraph } from "../docs/bead-layout.js";

const source = (count = 55) => ({
  groups: [{ id: "src/", label: "src/", color: "#2f6fd6" }, { id: "docs/", label: "docs/", color: "#3fa34d" }],
  nodes: Array.from({ length: count }, (_, index) => ({ id: `file-${index}`, label: `file-${index}`, group: index % 3 ? "src/" : "docs/" })),
  edges: [],
});

test("every file, including isolated files, sits on an anchored directory track", () => {
  const graph = positionGraph(source());
  assert.equal(graph.nodes.length, 55);
  assert.deepEqual(graph.edges, [], "support tracks do not invent dependencies");
  for (const node of graph.nodes) {
    const rail = graph.rails.find((item) => item.id === node.rail);
    assert.equal(rail.group, node.group);
    const { position } = pointAlong(rail.points, node.fraction);
    assert.ok(Math.hypot(node.x - position[0], node.y - position[1], node.z - position[2]) < 0.001);
    assert.ok(Math.abs(Math.hypot(...node.tangent) - 1) < 0.001);
  }
  for (const rail of graph.rails) {
    assert.equal(rail.points[0][1], 42);
    assert.equal(rail.points.at(-1)[1], 42);
    for (const [x, , z] of rail.points) {
      assert.ok(Math.abs(x) < graph.width / 2);
      assert.ok(Math.abs(z) < graph.depth / 2);
    }
  }
});

test("beads have physical clearance rather than intersecting at tight bends", () => {
  const graph = positionGraph(source(240));
  for (let a = 0; a < graph.nodes.length; a++) for (let b = a + 1; b < graph.nodes.length; b++) {
    const first = graph.nodes[a], second = graph.nodes[b];
    assert.ok(Math.hypot(first.x - second.x, first.y - second.y, first.z - second.z) > 50, `${first.id} intersects ${second.id}`);
  }
});

test("empty and single-file repositories have finite, repeatable layouts", () => {
  assert.deepEqual(positionGraph(source()), positionGraph(source()));
  for (const count of [0, 1]) {
    const graph = positionGraph(source(count));
    assert.ok(Number.isFinite(graph.extent));
    assert.equal(graph.nodes.length, count);
    assert.equal(graph.rails.length, count);
  }
});

function distanceToSegment(point, a, b) {
  const delta = b.map((value, axis) => value - a[axis]);
  const square = delta.reduce((sum, value) => sum + value * value, 0);
  const t = Math.max(0, Math.min(1, delta.reduce((sum, value, axis) => sum + value * (point[axis] - a[axis]), 0) / square));
  return Math.hypot(...point.map((value, axis) => value - a[axis] - delta[axis] * t));
}

test("the maze mixes high loops, corkscrews, and low winding paths with clear crossings", () => {
  const graph = positionGraph(source(120));
  assert.deepEqual(new Set(graph.rails.map((rail) => rail.kind)), new Set(["tall-loop", "corkscrew", "low-winding"]));
  const tallest = Math.max(...graph.rails.flatMap((rail) => rail.points.map((point) => point[1])));
  function winding(points, axes) {
    const center = axes.map((axis) => (Math.min(...points.map((point) => point[axis])) + Math.max(...points.map((point) => point[axis]))) / 2);
    let turn = 0;
    for (let i = 1; i < points.length; i++) {
      const angle = (point) => Math.atan2(point[axes[1]] - center[1], point[axes[0]] - center[0]);
      const delta = angle(points[i]) - angle(points[i - 1]);
      turn += Math.atan2(Math.sin(delta), Math.cos(delta));
    }
    return Math.abs(turn);
  }
  for (const rail of graph.rails) {
    const main = rail.points.slice(rail.beadStart, rail.beadEnd + 1);
    if (rail.kind === "tall-loop") {
      assert.ok(winding(main, [0, 1]) > Math.PI * 1.7, "tall tracks form upright loops");
    } else if (rail.kind === "corkscrew") {
      assert.ok(winding(main, [0, 2]) > Math.PI * 2.5, "corkscrews make multiple horizontal revolutions");
    } else {
      assert.ok(Math.max(...main.map((point) => point[1])) < tallest * 0.5, "winding tracks stay close to the board");
      const signs = main.slice(1).map((point, index) => Math.sign(point[0] - main[index][0])).filter(Boolean);
      assert.ok(signs.filter((sign, index) => index && sign !== signs[index - 1]).length >= 2, "low paths wind back and forth");
    }
  }
  for (let a = 0; a < graph.rails.length; a++) for (let b = a + 1; b < graph.rails.length; b++) {
    const first = graph.rails[a].points, second = graph.rails[b].points;
    for (let i = 0; i < first.length; i += 4) for (let j = 4; j < second.length; j += 4) {
      assert.ok(distanceToSegment(first[i], second[j - 4], second[j]) > 12, "painted wires must not pass through each other");
    }
  }
});

test("beads clear the other intertwined wires", () => {
  const graph = positionGraph(source(240));
  for (const node of graph.nodes) for (const rail of graph.rails) {
    if (rail.id === node.rail) continue;
    const center = [node.x, node.y, node.z];
    for (let i = 1; i < rail.points.length; i++) {
      assert.ok(distanceToSegment(center, rail.points[i - 1], rail.points[i]) > 30, `${node.id} intersects another track`);
    }
  }
});
