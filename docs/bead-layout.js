// Directory tracks are structural. Reference edges remain a separate graph.
export function pointAlong(points, fraction, arcLengths) {
  const lengths = arcLengths || [0];
  if (!arcLengths) for (let i = 1; i < points.length; i++) lengths.push(lengths[i - 1] + Math.hypot(...points[i].map((v, axis) => v - points[i - 1][axis])));
  const distance = Math.max(0, Math.min(1, fraction)) * lengths.at(-1);
  let index = 1;
  while (index < lengths.length - 1 && lengths[index] < distance) index++;
  const a = points[index - 1];
  const b = points[index];
  const amount = (distance - lengths[index - 1]) / (lengths[index] - lengths[index - 1] || 1);
  const length = Math.hypot(...b.map((v, axis) => v - a[axis]));
  return { position: a.map((v, axis) => v + (b[axis] - v) * amount), tangent: b.map((v, axis) => (v - a[axis]) / (length || 1)) };
}

const distance = (a, b) => Math.hypot(...a.map((value, axis) => value - b[axis]));

function clearsBore(points, lengths, fraction, placement) {
  // All five bores have radius 7, while the support tube has radius 4.8.
  // Inspect a 44-unit axial span (longest bead + lip), retaining a 0.45-unit
  // margin for Catmull-Rom interpolation between these sampled track points.
  const length = lengths.at(-1);
  for (const offset of [-22, -16, -8, 8, 16, 22]) {
    const point = pointAlong(points, fraction + offset / length, lengths).position;
    const delta = point.map((value, axis) => value - placement.position[axis]);
    const axial = delta.reduce((sum, value, axis) => sum + value * placement.tangent[axis], 0);
    const radial = Math.sqrt(Math.max(0, delta.reduce((sum, value) => sum + value * value, 0) - axial * axial));
    if (radial > 1.75) return false;
  }
  return true;
}

function connector(points, a, b, upA, upB) {
  for (let i = points.length && distance(points.at(-1), a) < 0.001 ? 1 : 0; i <= 32; i++) {
    const t = i / 32, u = 1 - t;
    points.push(a.map((value, axis) => u ** 3 * value + 3 * u * u * t * upA[axis] + 3 * u * t * t * upB[axis] + t ** 3 * b[axis]));
  }
}

function makeTrack(kind, rank, counts, sequence, members = 18) {
  // Compact the track for sparse runs so few-bead rails read like real toys
  // instead of long bare wires; dense runs keep the full footprint.
  const fit = Math.min(1, Math.max(0.6, 0.62 + members / 26));
  const points = [];
  let from, to, opening;
  if (kind === "tall-loop") {
    const radius = Math.round((250 + rank * 65) * fit);
    const cx = 130, cy = 165 + radius, cz = 80 + rank * 65;
    opening = { center: [cx, cy, cz], radius };
    const loop = [];
    for (let i = 0; i <= 320; i++) {
      const angle = -Math.PI / 2 + 0.24 + (Math.PI * 2 - 0.48) * i / 320;
      loop.push([cx + radius * Math.cos(angle), cy + radius * Math.sin(angle), cz + 75 * Math.sin(angle * 2)]);
    }
    const start = [cx + (105 + rank * 65) * fit, 37.5, cz - 130];
    const end = [cx - (105 + rank * 65) * fit, 37.5, cz + 130];
    connector(points, start, loop[0], [start[0], 105, start[2]], [loop[0][0] + 55, loop[0][1] - 12, loop[0][2] - 40]);
    from = points.length - 1;
    points.push(...loop.slice(1));
    to = points.length - 1;
    connector(points, loop.at(-1), end, [loop.at(-1)[0] - 55, loop.at(-1)[1] - 12, loop.at(-1)[2] + 40], [end[0], 105, end[2]]);
  } else if (kind === "corkscrew") {
    const phase = rank / counts.corkscrew * Math.PI * 2;
    const cx = -190, cz = -95, radius = Math.round(Math.max(170, counts.corkscrew * 45) * fit);
    const rise = Math.max(520, counts.corkscrew * 160);
    for (let i = 0; i <= 32; i++) {
      const t = i / 32, angle = phase - Math.PI / 4 + Math.PI / 4 * t * t;
      points.push([cx + radius * Math.cos(angle), 37.5 + 70 * t, cz + radius * Math.sin(angle)]);
    }
    from = points.length - 1;
    for (let i = 1; i <= 320; i++) {
      const t = i / 320, angle = phase + Math.PI * 3.4 * t;
      const r = radius * (1 - 0.18 * t);
      points.push([cx + r * Math.cos(angle), 112 + rise * t, cz + r * Math.sin(angle)]);
    }
    to = points.length - 1;
    const top = points.at(-1), angle = phase + Math.PI * 3.4 + Math.PI / 2;
    const end = [cx + (radius + 105 * fit) * Math.cos(angle), 37.5, cz + (radius + 105 * fit) * Math.sin(angle)];
    connector(points, top, end, [top[0] - Math.sin(angle - Math.PI / 2) * 160, top[1] + 110, top[2] + Math.cos(angle - Math.PI / 2) * 160], [end[0], top[1] + 70, end[2]]);
  } else {
    for (let i = 0; i <= 320; i++) {
      const t = i / 320;
      // Horizontal span compacts with fit; the vertical climb stays full so the
      // first bead slots keep bore-plus-shell clearance above the board top.
      points.push([-340 * Math.cos(Math.PI * 3 * t) * fit + rank * 70 * Math.cos(Math.PI * t) * fit,
        i === 0 || i === 320 ? 37.5 : 42 + (105 + rank * 68) * Math.sin(Math.PI * t), -280 + 560 * t + rank * 30]);
    }
    from = 0; to = points.length - 1;
  }
  const origin = kind === "tall-loop" ? [130, 80 + rank * 65] : kind === "corkscrew" ? [-190, -95] : [0, rank * 30];
  const yaw = kind === "tall-loop" ? -0.3 + rank * Math.PI * 0.47 : kind === "corkscrew" ? 0.4 + rank * 0.18 : Math.PI / 4 + rank * Math.PI / 3;
  const lean = kind === "corkscrew" ? 0.12 : kind === "tall-loop" ? 0.06 : 0;
  const tilt = sequence * 2.399963229728653;
  function transform(point) {
    const x = point[0] - origin[0], z = point[2] - origin[1];
    return [x * Math.cos(yaw) - z * Math.sin(yaw) + (point[1] - 37.5) * lean * Math.cos(tilt), point[1],
      x * Math.sin(yaw) + z * Math.cos(yaw) + (point[1] - 37.5) * lean * Math.sin(tilt)];
  }
  for (let i = 0; i < points.length; i++) points[i] = transform(points[i]);
  if (opening) opening = { ...opening, center: transform(opening.center), axis: [Math.cos(yaw), Math.sin(yaw)], lean: [lean * Math.cos(tilt), lean * Math.sin(tilt)] };
  return { points, beadStart: from, beadEnd: to, poseAngle: tilt, opening, fitScale: fit };
}

function closest(point, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2];
  const square = dx * dx + dy * dy + dz * dz;
  const t = square ? Math.max(0, Math.min(1, ((point[0] - a[0]) * dx + (point[1] - a[1]) * dy + (point[2] - a[2]) * dz) / square)) : 0;
  const position = [a[0] + dx * t, a[1] + dy * t, a[2] + dz * t];
  return { position, distance: distance(point, position) };
}

class TrackSpace {
  cells = new Map();
  add(rail) {
    for (let i = 1; i < rail.points.length; i++) {
      const a = rail.points[i - 1], b = rail.points[i];
      const min = a.map((value, axis) => Math.floor((Math.min(value, b[axis]) - 64) / 64));
      const max = a.map((value, axis) => Math.floor((Math.max(value, b[axis]) + 64) / 64));
      const segment = { a, b, rail: rail.id };
      for (let x = min[0]; x <= max[0]; x++) for (let y = min[1]; y <= max[1]; y++) for (let z = min[2]; z <= max[2]; z++) {
        const key = `${x},${y},${z}`;
        if (!this.cells.has(key)) this.cells.set(key, []);
        this.cells.get(key).push(segment);
      }
    }
  }
  nearest(point, skip) {
    const key = point.map((value) => Math.floor(value / 64)).join(",");
    let nearest;
    for (const segment of this.cells.get(key) || []) {
      if (segment.rail === skip) continue;
      const hit = closest(point, segment.a, segment.b);
      if (!nearest || hit.distance < nearest.distance) nearest = { ...hit, segment };
    }
    return nearest;
  }
}

function resampleTrack(rail) {
  const original = rail.points;
  const lengths = [0];
  for (let i = 1; i < original.length; i++) lengths.push(lengths[i - 1] + distance(original[i - 1], original[i]));
  const length = lengths.at(-1), steps = Math.ceil(length / 8);
  const start = lengths[rail.beadStart] / length, end = lengths[rail.beadEnd] / length;
  const points = [];
  let index = 1;
  for (let i = 0; i <= steps; i++) {
    const target = i / steps * length;
    while (index < original.length - 1 && lengths[index] < target) index++;
    const t = (target - lengths[index - 1]) / (lengths[index] - lengths[index - 1] || 1);
    points.push(original[index - 1].map((value, axis) => value + (original[index][axis] - value) * t));
  }
  points[0] = [...original[0]]; points[points.length - 1] = [...original.at(-1)];
  rail.points = points;
  rail.beadStart = Math.ceil(start * steps); rail.beadEnd = Math.floor(end * steps);
}

function threadsOpening(points, opening) {
  const local = (point) => {
    const y = point[1] - opening.center[1];
    const x = point[0] - opening.center[0] - opening.lean[0] * y;
    const z = point[2] - opening.center[2] - opening.lean[1] * y;
    return [x * opening.axis[0] + z * opening.axis[1], y, -x * opening.axis[1] + z * opening.axis[0]];
  };
  let previous = local(points[0]);
  for (let i = 1; i < points.length; i++) {
    const next = local(points[i]);
    if (previous[2] * next[2] < 0) {
      const t = previous[2] / (previous[2] - next[2]);
      const x = previous[0] + (next[0] - previous[0]) * t;
      const y = previous[1] + (next[1] - previous[1]) * t;
      if ((x * x + y * y) / opening.radius ** 2 < 0.64) return true;
    }
    previous = next;
  }
  return false;
}

function placeTrack(rail, space, peers) {
  const original = rail.points;
  const loops = peers.filter((peer) => peer.kind === "tall-loop");
  const corks = peers.filter((peer) => peer.kind === "corkscrew");
  const cores = corks.map((peer) => {
    const main = peer.points.slice(peer.beadStart, peer.beadEnd + 1);
    return { x: main.reduce((sum, point) => sum + point[0], 0) / main.length,
      z: main.reduce((sum, point) => sum + point[2], 0) / main.length,
      height: Math.max(...main.map((point) => point[1])) };
  });
  const turns = [0, Math.PI / 12, -Math.PI / 12, Math.PI / 6, -Math.PI / 6, Math.PI / 4, -Math.PI / 4];
  // Real toys spread anchors across the whole board instead of crowding the
  // center, so rank poses by the gap at their centroid, then fully validate
  // only the widest handful. First fit would pile rails onto the middle.
  const poses = [];
  for (let radius = 0; radius <= 768; radius += 32) {
    for (const turn of turns) {
      for (let step = 0; step < (radius ? 24 : 1); step++) {
        const angle = rail.poseAngle + step / 24 * Math.PI * 2;
        const mid = original[Math.floor(original.length / 2)];
        const [x, z] = [mid[0] * Math.cos(turn) - mid[2] * Math.sin(turn), mid[0] * Math.sin(turn) + mid[2] * Math.cos(turn)];
        const dx = Math.cos(angle) * radius, dz = Math.sin(angle) * radius;
        poses.push({ radius, turn, angle, gap: space.nearest([x + dx, mid[1], z + dz])?.distance ?? Infinity });
      }
    }
  }
  poses.sort((a, b) => (b.gap - a.gap) || (a.radius - b.radius));
  let chosen = null;
  for (const pose of poses) {
    const rotate = (x, z) => [x * Math.cos(pose.turn) - z * Math.sin(pose.turn), x * Math.sin(pose.turn) + z * Math.cos(pose.turn)];
    const rotated = original.map((point) => { const [x, z] = rotate(point[0], point[2]); return [x, point[1], z]; });
    const dx = Math.cos(pose.angle) * pose.radius, dz = Math.sin(pose.angle) * pose.radius;
    const points = rotated.map((point) => [point[0] + dx, point[1], point[2] + dz]);
    let opening;
    if (rail.opening) {
      const center = rotate(rail.opening.center[0], rail.opening.center[2]);
      opening = { ...rail.opening, center: [center[0] + dx, rail.opening.center[1], center[1] + dz],
        axis: rotate(...rail.opening.axis), lean: rotate(...rail.opening.lean) };
    }
    if (rail.kind === "corkscrew" && loops.length && !loops.some((loop) => threadsOpening(points.slice(rail.beadStart, rail.beadEnd + 1), loop.opening))) continue;
    if (opening && corks.length && !corks.some((cork) => threadsOpening(cork.points.slice(cork.beadStart, cork.beadEnd + 1), opening))) continue;
    if (rail.kind === "low-winding" && cores.length && !cores.some((core) => points.some((point) => Math.hypot(point[0] - core.x, point[2] - core.z) < 120 && point[1] < core.height * 0.6))) continue;
    // Label crowding on sparse maps is handled in the scene (sparse maps
    // keep every label visible); tracks pack with the tuned clearance.
    if (points.some((point) => (space.nearest(point)?.distance ?? Infinity) < 26)) continue;
    chosen = { points, opening };
    break;
  }
  if (!chosen) throw new Error(`Cannot weave ${rail.id} with physical track clearance.`);
  rail.points = chosen.points;
  rail.opening = chosen.opening;
}

export function positionGraph(graph) {
  const kinds = ["tall-loop", "corkscrew", "low-winding"];
  const batches = [];
  for (const group of graph.groups) {
    const members = graph.nodes.filter((node) => node.group === group.id);
    for (let start = 0; start < members.length; start += 18) {
      batches.push({ group, members: members.slice(start, start + 18), part: start / 18 + 1, parts: Math.ceil(members.length / 18), kind: kinds[batches.length % 3] });
    }
  }
  const stationCount = Math.ceil(batches.length / 12);
  const counts = Array.from({ length: stationCount }, (_, station) => Object.fromEntries(kinds.map((kind) => [kind, batches.slice(station * 12, station * 12 + 12).filter((batch) => batch.kind === kind).length])));
  const ranks = counts.map(() => Object.fromEntries(kinds.map((kind) => [kind, 0])));
  const rails = batches.map(({ group, part, parts, kind, members: batchMembers }, index) => {
    const station = Math.floor(index / 12);
    return { id: `${group.id}:${part}`, group: group.id, label: parts > 1 ? `${group.label} ${part}/${parts}` : group.label,
      color: group.color, kind, station, ...makeTrack(kind, ranks[station][kind]++, counts[station], index % 12, batchMembers.length) };
  });
  const stations = Array.from({ length: stationCount }, (_, station) => rails.filter((rail) => rail.station === station));
  const boxes = [];
  for (const members of stations) {
    const localSpace = new TrackSpace();
    const placed = [];
    for (const rail of members) {
      resampleTrack(rail); placeTrack(rail, localSpace, placed); localSpace.add(rail); placed.push(rail);
    }
    const points = members.flatMap((rail) => rail.points);
    const minX = Math.min(...points.map((point) => point[0])), maxX = Math.max(...points.map((point) => point[0]));
    const minZ = Math.min(...points.map((point) => point[2])), maxZ = Math.max(...points.map((point) => point[2]));
    boxes.push({ x: (minX + maxX) / 2, z: (minZ + maxZ) / 2, width: maxX - minX, depth: maxZ - minZ });
  }
  const columns = Math.max(1, Math.ceil(Math.sqrt(stationCount))), rows = Math.ceil(stationCount / columns);
  const cellWidth = Math.max(0, ...boxes.map((box) => box.width)) + 140;
  const cellDepth = Math.max(0, ...boxes.map((box) => box.depth)) + 140;
  const space = new TrackSpace();
  stations.forEach((members, station) => {
    const row = Math.floor(station / columns), column = station % columns;
    const rowSize = Math.min(columns, stationCount - row * columns);
    const dx = (column - (rowSize - 1) / 2) * cellWidth - boxes[station].x;
    const dz = (row - (rows - 1) / 2) * cellDepth - boxes[station].z;
    for (const rail of members) {
      for (const point of rail.points) { point[0] += dx; point[2] += dz; }
      if (rail.opening) { rail.opening.center[0] += dx; rail.opening.center[2] += dz; }
      space.add(rail);
      const high = rail.points.reduce((best, point) => point[1] > best[1] ? point : best);
      rail.labelPosition = [high[0], high[1] + 50, high[2]];
    }
  });
  const nodes = [];
  rails.forEach((rail, index) => {
    const { points, beadStart, beadEnd } = rail;
    const lengths = [0];
    for (let i = 1; i < points.length; i++) lengths.push(lengths[i - 1] + distance(points[i], points[i - 1]));
    const length = lengths.at(-1), from = lengths[beadStart] / length, to = lengths[beadEnd] / length;
    const members = batches[index].members;
    const slots = [];
    const first = from + (to - from) * 0.035, last = to - (to - from) * 0.035;
    for (let fraction = first; fraction <= last; fraction += 6 / length) {
      const candidate = pointAlong(points, fraction, lengths);
      if (!clearsBore(points, lengths, fraction, candidate)) continue;
      if ((space.nearest(candidate.position, rail.id)?.distance ?? Infinity) <= 32) continue;
      if (nodes.some((other) => distance(candidate.position, [other.x, other.y, other.z]) <= 54)) continue;
      if (slots.some((other) => distance(candidate.position, other.position) <= 54)) continue;
      slots.push({ ...candidate, fraction });
    }
    if (slots.length < members.length) throw new Error(`Cannot place ${rail.id} with physical bead clearance (${slots.length} slots for ${members.length} files).`);
    members.forEach((node, i) => {
      const slot = members.length === 1 ? Math.floor(slots.length / 2) : Math.round(i / (members.length - 1) * (slots.length - 1));
      const placement = slots[slot];
      nodes.push({ ...node, rail: rail.id, fraction: placement.fraction, color: rail.color,
        x: placement.position[0], y: placement.position[1], z: placement.position[2], tangent: placement.tangent });
    });
  });
  const width = Math.max(700, ...rails.flatMap((rail) => rail.points.map((point) => Math.abs(point[0]) * 2 + 60)));
  const depth = Math.max(650, ...rails.flatMap((rail) => rail.points.map((point) => Math.abs(point[2]) * 2 + 60)));
  return { ...graph, nodes, rails, width, depth, extent: Math.max(width, depth) / 2 };
}
