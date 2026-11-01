import test from "node:test";
import assert from "node:assert/strict";
import { positionGraph } from "../docs/bead-layout.js";

const graph = positionGraph({
  groups: Array.from({ length: 9 }, (_, index) => ({ id: String(index), label: String(index), color: "#2f6fd6" })),
  nodes: Array.from({ length: 95 }, (_, index) => ({ id: String(index), group: String(index % 9) })),
  edges: [],
});
const main = (rail) => rail.points.slice(rail.beadStart, rail.beadEnd + 1);

// Derive a loop's opening from its vertices, independently of the placement frame.
function openingFromVertices(rail) {
  const points = main(rail);
  const mean = [0, 1, 2].map((axis) => points.reduce((sum, point) => sum + point[axis], 0) / points.length);
  const xx = points.reduce((sum, point) => sum + (point[0] - mean[0]) ** 2, 0);
  const zz = points.reduce((sum, point) => sum + (point[2] - mean[2]) ** 2, 0);
  const xz = points.reduce((sum, point) => sum + (point[0] - mean[0]) * (point[2] - mean[2]), 0);
  const angle = Math.atan2(2 * xz, xx - zz) / 2;
  const along = (point) => point[0] * Math.cos(angle) + point[2] * Math.sin(angle);
  const across = (point) => -point[0] * Math.sin(angle) + point[2] * Math.cos(angle);
  const xmin = Math.min(...points.map(along)), xmax = Math.max(...points.map(along));
  const ymin = Math.min(...points.map((point) => point[1])), ymax = Math.max(...points.map((point) => point[1]));
  const yy = points.reduce((sum, point) => sum + (point[1] - mean[1]) ** 2, 0);
  const slope = points.reduce((sum, point) => sum + (across(point) - across(mean)) * (point[1] - mean[1]), 0) / yy;
  return {
    side: (point) => across(point) - across(mean) - slope * (point[1] - mean[1]),
    inside: (point) => ((along(point) - (xmin + xmax) / 2) / ((xmax - xmin) / 2)) ** 2
      + ((point[1] - (ymin + ymax) / 2) / ((ymax - ymin) / 2)) ** 2 < 0.64,
  };
}

function threads(rail, loop) {
  const opening = openingFromVertices(loop), points = main(rail);
  for (let index = 1; index < points.length; index++) {
    const a = points[index - 1], b = points[index];
    const first = opening.side(a), second = opening.side(b);
    if (first * second >= 0) continue;
    const t = first / (first - second);
    if (opening.inside(a.map((value, axis) => value + (b[axis] - value) * t))) return true;
  }
  return false;
}

test("corkscrews pass through tall-loop openings rather than occupying separate regions", () => {
  const loops = graph.rails.filter((rail) => rail.kind === "tall-loop");
  const corkscrews = graph.rails.filter((rail) => rail.kind === "corkscrew");
  for (const corkscrew of corkscrews) assert.ok(loops.some((loop) => threads(corkscrew, loop)), `${corkscrew.id} must thread a loop`);
  for (const loop of loops) assert.ok(corkscrews.some((corkscrew) => threads(corkscrew, loop)), `${loop.id} must surround a corkscrew`);
});

test("low winding paths cross beneath both other track types", () => {
  for (const low of graph.rails.filter((rail) => rail.kind === "low-winding")) {
    for (const kind of ["tall-loop", "corkscrew"]) {
      const above = graph.rails.filter((rail) => rail.kind === kind).flatMap(main);
      assert.ok(main(low).some((point) => above.some((other) => Math.hypot(point[0] - other[0], point[2] - other[2]) < 80 && other[1] - point[1] > 45)), `${low.id} must wind below ${kind} tracks`);
    }
  }
});
