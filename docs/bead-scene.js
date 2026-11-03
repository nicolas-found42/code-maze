import { createCanvasMaze } from "./bead-fallback.js";
export { positionGraph } from "./bead-layout.js";

export function createMaze(container, onSelect) {
  const THREE = window.THREE;
  if (!THREE) return createCanvasMaze(container, onSelect);
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ antialias: true }); }
  catch { return createCanvasMaze(container, onSelect); }
  container.replaceChildren(renderer.domElement);
  container.dataset.renderer = "webgl";
  const canvas = renderer.domElement;
  canvas.tabIndex = 0;
  canvas.setAttribute("aria-label", "Physical codebase bead maze. Drag or use arrow keys to orbit, scroll or use plus and minus to zoom, and hover for file names.");
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf0e9dd);
  const camera = new THREE.PerspectiveCamera(38, 1, 1, 100000);
  scene.add(new THREE.HemisphereLight(0xfff8ee, 0x99734c, 2.0));
  const key = new THREE.DirectionalLight(0xfff4de, 3.0);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.bias = -0.00025;
  key.shadow.normalBias = 1.5;
  scene.add(key, key.target);
  const fill = new THREE.DirectionalLight(0xdce9ff, 1.4);
  fill.position.set(-400, 450, -650);
  scene.add(fill);
  const labelLayer = document.createElement("div");
  labelLayer.className = "scene-labels";
  labelLayer.setAttribute("aria-hidden", "true");
  container.append(labelLayer);
  const hoverText = document.createElement("div");
  hoverText.className = "bead-tooltip";
  hoverText.hidden = true;
  container.append(hoverText);
  const target = new THREE.Vector3();
  const direction = new THREE.Vector3();
  const initialTheta = -0.45;
  let theta = initialTheta, phi = 0.94, radius = 1500, zoom = 1;
  let content, bounds, graph, fitPoints = [], meshes = [], rails = [], labels = [], selected, hovered, names = true, frame, down;
  const referenceLayer = new THREE.Group();
  scene.add(referenceLayer);
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const halo = new THREE.Mesh(new THREE.TorusGeometry(30, 3, 10, 48), new THREE.MeshBasicMaterial({ color: 0xffc93d, depthTest: false }));
  halo.renderOrder = 20;
  halo.visible = false;
  scene.add(halo);

  function invalidate() { if (!frame) frame = requestAnimationFrame(render); }
  const loader = new THREE.TextureLoader();
  const woodTexture = loader.load("./vendor/ash_veneer_diff_1k.jpg", invalidate);
  woodTexture.colorSpace = THREE.SRGBColorSpace;
  woodTexture.wrapS = woodTexture.wrapT = THREE.RepeatWrapping;
  woodTexture.repeat.set(1.7, 1.7);
  const wood = new THREE.MeshStandardMaterial({ map: woodTexture, color: 0xe1bd8a, roughness: 0.57 });
  const plyCanvas = document.createElement("canvas");
  plyCanvas.width = 32; plyCanvas.height = 128;
  const plyContext = plyCanvas.getContext("2d");
  for (let y = 0; y < 128; y += 8) {
    plyContext.fillStyle = y % 16 ? "#ad8050" : "#e4c59c";
    plyContext.fillRect(0, y, 32, 8);
  }
  const plyTexture = new THREE.CanvasTexture(plyCanvas);
  plyTexture.wrapS = plyTexture.wrapT = THREE.RepeatWrapping;
  plyTexture.colorSpace = THREE.SRGBColorSpace;
  const ply = new THREE.MeshStandardMaterial({ map: plyTexture, roughness: 0.72 });
  const noiseCanvas = document.createElement("canvas");
  noiseCanvas.width = noiseCanvas.height = 128;
  const noiseContext = noiseCanvas.getContext("2d");
  const noisePixels = noiseContext.createImageData(128, 128);
  for (let i = 0; i < noisePixels.data.length; i += 4) {
    const value = 170 + (i * 13 % 71);
    noisePixels.data.set([value, value, value, 255], i);
  }
  noiseContext.putImageData(noisePixels, 0, 0);
  const paintTexture = new THREE.CanvasTexture(noiseCanvas);
  const environment = loader.load("./vendor/studio.jpg", () => {
    environment.mapping = THREE.EquirectangularReflectionMapping;
    scene.environment = environment;
    invalidate();
  });
  environment.colorSpace = THREE.SRGBColorSpace;
  const boredBead = (profile, segments) => new THREE.LatheGeometry([...profile, profile[0]].map(([x, y]) => new THREE.Vector2(x, y)), segments);
  const sharedGeometry = [
    boredBead([[7, 21], [13, 20], [20, 13], [23, 0], [20, -13], [13, -20], [7, -21]], 28),
    boredBead([[7, 16], [22, 16], [23, 12], [23, -12], [22, -16], [7, -16]], 6),
    boredBead([[7, 12], [22, 12], [25, 5], [25, -5], [22, -12], [7, -12]], 28),
  ];
  const sharedMaterials = new Set([wood, ply]);
  function dispose(group) {
    group.traverse((object) => {
      if (object.geometry && !sharedGeometry.includes(object.geometry)) object.geometry.dispose();
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of materials) if (material && !sharedMaterials.has(material)) material.dispose();
    });
    group.clear();
  }
  function project(position) {
    const point = position.clone().project(camera);
    return { x: (point.x + 1) / 2 * container.clientWidth, y: (1 - point.y) / 2 * container.clientHeight, visible: point.z > -1 && point.z < 1 };
  }
  function layoutLabels() {
    const occupied = [];
    const ordered = [...labels].sort((a, b) => {
      const priority = (label) => label.kind === "file" && label.id === selected ? 0 : label.kind === "file" && label.id === hovered ? 1 : label.kind === "track" ? 2 : label.element.classList.contains("is-related") ? 3 : 4;
      return priority(a) - priority(b) || b.degree - a.degree;
    });
    for (const label of ordered) {
      const active = label.kind === "file" && (label.id === selected || label.id === hovered);
      if (label.kind === "file" && !names && !active) { label.element.hidden = true; continue; }
      const point = project(label.position);
      const width = label.kind === "track" ? 86 : Math.min(185, label.text.length * 6.1 + 16);
      const height = active ? 27 : 22;
      const x = Math.max(6, Math.min(container.clientWidth - width - 6, point.x - width / 2));
      const y = point.y - height;
      const box = { x, y, right: x + width, bottom: y + height };
      const overlap = occupied.some((item) => box.x < item.right + 5 && box.right > item.x - 5 && box.y < item.bottom + 4 && box.bottom > item.y - 4);
      const visible = point.visible && y > 5 && y + height < container.clientHeight - 5 && (!overlap || active);
      label.element.hidden = !visible;
      if (!visible) continue;
      label.element.style.transform = `translate(${x}px, ${y}px)`;
      label.element.classList.toggle("is-selected", label.kind === "file" && label.id === selected);
      label.element.classList.toggle("is-hovered", label.kind === "file" && label.id === hovered);
      occupied.push(box);
    }
  }
  function render() {
    frame = undefined;
    if (halo.visible) halo.quaternion.copy(camera.quaternion);
    renderer.render(scene, camera);
    layoutLabels();
  }
  function orient() {
    direction.set(Math.sin(phi) * Math.sin(theta), Math.cos(phi), Math.sin(phi) * Math.cos(theta));
    camera.position.copy(target).addScaledVector(direction, radius * zoom);
    camera.lookAt(target);
  }
  function fit() {
    if (!bounds) return;
    bounds.getCenter(target);
    orient();
    const inverse = camera.quaternion.clone().invert();
    const tanY = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const tanX = tanY * camera.aspect;
    let distance = 0;
    for (const point of fitPoints) {
      const local = point.clone().sub(target).applyQuaternion(inverse);
      distance = Math.max(distance, local.z + Math.max(Math.abs(local.x) / tanX, Math.abs(local.y) / tanY));
    }
    radius = distance * 1.06;
    orient();
    for (let pass = 0; pass < 4; pass++) {
      camera.updateMatrixWorld();
      const points = fitPoints.map((point) => point.clone().project(camera));
      const minX = Math.min(...points.map((point) => point.x)), maxX = Math.max(...points.map((point) => point.x));
      const minY = Math.min(...points.map((point) => point.y)), maxY = Math.max(...points.map((point) => point.y));
      const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
      const up = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
      target.addScaledVector(right, (minX + maxX) / 2 * radius * tanX);
      target.addScaledVector(up, (minY + maxY) / 2 * radius * tanY);
      radius *= THREE.MathUtils.clamp(Math.max(maxX - minX, maxY - minY) / 1.8, 0.75, 1.15);
      orient();
    }
    invalidate();
  }
  function resize() {
    if (!container.clientWidth || !container.clientHeight) return;
    renderer.setSize(container.clientWidth, container.clientHeight);
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    fit(); invalidate();
  }
  new ResizeObserver(resize).observe(container);
  function hitAt(event) {
    const rectangle = canvas.getBoundingClientRect();
    pointer.set((event.clientX - rectangle.left) / rectangle.width * 2 - 1, -(event.clientY - rectangle.top) / rectangle.height * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    return raycaster.intersectObjects(meshes, false)[0]?.object;
  }
  canvas.addEventListener("pointerdown", (event) => {
    down = { x: event.clientX, y: event.clientY, theta, phi };
    canvas.setPointerCapture(event.pointerId);
    hoverText.hidden = true;
  });
  canvas.addEventListener("pointermove", (event) => {
    if (down) {
      theta = down.theta - (event.clientX - down.x) * 0.006;
      phi = Math.max(0.22, Math.min(1.48, down.phi - (event.clientY - down.y) * 0.006));
      orient(); invalidate(); return;
    }
    const hit = hitAt(event);
    hovered = hit?.userData.id;
    canvas.style.cursor = hit ? "pointer" : "grab";
    if (hit) {
      hoverText.textContent = hit.userData.id;
      const rectangle = canvas.getBoundingClientRect();
      hoverText.style.left = `${Math.max(8, Math.min(event.clientX - rectangle.left + 14, container.clientWidth - hoverText.offsetWidth - 8))}px`;
      hoverText.style.top = `${Math.max(8, event.clientY - rectangle.top - 38)}px`;
    }
    hoverText.hidden = !hit;
    invalidate();
  });
  canvas.addEventListener("pointerleave", () => { hovered = undefined; hoverText.hidden = true; invalidate(); });
  canvas.addEventListener("pointercancel", () => { down = undefined; });
  canvas.addEventListener("pointerup", (event) => {
    if (down && Math.hypot(event.clientX - down.x, event.clientY - down.y) < 5) {
      const hit = hitAt(event);
      if (hit) onSelect(hit.userData.id);
    }
    down = undefined;
  });
  canvas.addEventListener("wheel", (event) => {
    event.preventDefault(); zoom = Math.max(0.22, Math.min(2, zoom * Math.exp(event.deltaY * 0.001)));
    orient(); invalidate();
  }, { passive: false });
  canvas.addEventListener("keydown", (event) => {
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "+", "=", "-", "0"].includes(event.key)) return;
    event.preventDefault();
    if (event.key === "ArrowLeft") theta -= 0.18;
    if (event.key === "ArrowRight") theta += 0.18;
    if (event.key === "ArrowUp") phi = Math.max(0.22, phi - 0.12);
    if (event.key === "ArrowDown") phi = Math.min(1.48, phi + 0.12);
    if (["+", "="].includes(event.key)) zoom = Math.max(0.22, zoom * 0.85);
    if (event.key === "-") zoom = Math.min(2, zoom / 0.85);
    if (event.key === "0") { theta = initialTheta; phi = 0.94; zoom = 1; fit(); }
    orient(); invalidate();
  });
  function addLabel(text, position, kind, id, degree = 0) {
    const element = document.createElement("span");
    element.className = `scene-label ${kind}-label`;
    element.textContent = text;
    element.title = id || text;
    labelLayer.append(element);
    labels.push({ element, text, position: new THREE.Vector3(...position), kind, id, degree });
  }
  function makeReferences(id) {
    dispose(referenceLayer);
    if (!id) return;
    const byId = new Map(graph.nodes.map((node) => [node.id, node]));
    const edges = graph.edges.filter((edge) => edge.source === id || edge.target === id);
    edges.forEach((edge, index) => {
      const a = byId.get(edge.source), b = byId.get(edge.target);
      const color = edge.source === id ? 0xb86c18 : 0x315e94;
      const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(a.x, a.y, a.z), new THREE.Vector3((a.x + b.x) / 2, Math.max(a.y, b.y) + 110 + index * 16, (a.z + b.z) / 2), new THREE.Vector3(b.x, b.y, b.z));
      const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(curve.getPoints(64)), new THREE.LineDashedMaterial({ color, dashSize: 10, gapSize: 6, depthTest: false, transparent: true, opacity: 0.95 }));
      line.computeLineDistances(); line.renderOrder = 8;
      referenceLayer.add(line);
      const arrow = new THREE.Mesh(new THREE.ConeGeometry(7, 20, 10), new THREE.MeshBasicMaterial({ color, depthTest: false }));
      arrow.position.copy(curve.getPoint(0.8));
      arrow.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), curve.getTangent(0.8).normalize());
      arrow.renderOrder = 9;
      referenceLayer.add(arrow);
    });
  }
  resize();
  return {
    setGraph(next) {
      if (content) { scene.remove(content); dispose(content); }
      dispose(referenceLayer);
      graph = next; selected = undefined; hovered = undefined; halo.visible = false;
      labelLayer.replaceChildren(); labels = []; meshes = []; rails = [];
      content = new THREE.Group(); scene.add(content);
      const shape = new THREE.Shape();
      const w = graph.width / 2, d = graph.depth / 2, r = 32;
      shape.moveTo(-w + r, -d); shape.lineTo(w - r, -d); shape.quadraticCurveTo(w, -d, w, -d + r);
      shape.lineTo(w, d - r); shape.quadraticCurveTo(w, d, w - r, d); shape.lineTo(-w + r, d);
      shape.quadraticCurveTo(-w, d, -w, d - r); shape.lineTo(-w, -d + r); shape.quadraticCurveTo(-w, -d, -w + r, -d);
      const boardGeometry = new THREE.ExtrudeGeometry(shape, { depth: 26, bevelEnabled: true, bevelSize: 4, bevelThickness: 3, bevelSegments: 4, curveSegments: 14 });
      const uv = boardGeometry.getAttribute("uv");
      for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / graph.width, uv.getY(i) / graph.depth);
      boardGeometry.rotateX(-Math.PI / 2);
      const board = new THREE.Mesh(boardGeometry, [wood, ply]);
      plyTexture.repeat.set(2, graph.depth / 26);
      board.position.y = 8; board.castShadow = true; board.receiveShadow = true; content.add(board);
      for (const x of [-w + 45, w - 45]) for (const z of [-d + 45, d - 45]) {
        const foot = new THREE.Mesh(new THREE.CylinderGeometry(20, 22, 12, 24), new THREE.MeshStandardMaterial({ color: 0x302820, roughness: 0.9 }));
        foot.position.set(x, 3, z); foot.castShadow = true; content.add(foot);
      }
      const ground = new THREE.Mesh(new THREE.PlaneGeometry(graph.width * 3, graph.depth * 4), new THREE.ShadowMaterial({ color: 0x65513b, opacity: 0.19 }));
      ground.rotation.x = -Math.PI / 2; ground.position.y = -4; ground.receiveShadow = true; content.add(ground);
      const degrees = new Map(graph.nodes.map((node) => [node.id, 0]));
      for (const edge of graph.edges) { degrees.set(edge.source, degrees.get(edge.source) + 1); degrees.set(edge.target, degrees.get(edge.target) + 1); }
      for (const rail of graph.rails) {
        const curve = new THREE.CatmullRomCurve3(rail.points.map((point) => new THREE.Vector3(...point)));
        const material = new THREE.MeshPhysicalMaterial({ color: rail.color, roughness: 0.3, metalness: 0.12, clearcoat: 0.8, envMapIntensity: 0.65 });
        const wire = new THREE.Mesh(new THREE.TubeGeometry(curve, Math.min(800, Math.max(200, rail.points.length)), 4.8, 10, false), material);
        wire.castShadow = true; wire.receiveShadow = true; wire.userData.group = rail.group;
        content.add(wire); rails.push(wire);
        for (const point of [rail.points[0], rail.points.at(-1)]) {
          const pad = new THREE.Mesh(new THREE.CylinderGeometry(18, 19, 5, 24), new THREE.MeshStandardMaterial({ color: rail.color, roughness: 0.55 }));
          pad.position.set(point[0], 36, point[2]); pad.receiveShadow = true; content.add(pad);
          const grommet = new THREE.Mesh(new THREE.TorusGeometry(7, 2.5, 10, 24), new THREE.MeshStandardMaterial({ color: 0x302e29, metalness: 0.5, roughness: 0.4 }));
          grommet.rotation.x = -Math.PI / 2; grommet.position.set(point[0], 40, point[2]); content.add(grommet);
        }
        addLabel(rail.label, rail.labelPosition, "track");
      }
      graph.nodes.forEach((node, index) => {
        const material = new THREE.MeshPhysicalMaterial({ color: node.color, roughness: 0.4, metalness: 0, clearcoat: 0.42, clearcoatRoughness: 0.28, envMapIntensity: 0.55, bumpMap: paintTexture, bumpScale: 0.09, transparent: true });
        const mesh = new THREE.Mesh(sharedGeometry[index % sharedGeometry.length], material);
        mesh.position.set(node.x, node.y, node.z);
        mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(...node.tangent));
        mesh.userData = { id: node.id, group: node.group, color: node.color };
        mesh.castShadow = true; mesh.receiveShadow = true;
        content.add(mesh); meshes.push(mesh);
        addLabel(node.label, [node.x, node.y + 32, node.z], "file", node.id, degrees.get(node.id));
      });
      bounds = new THREE.Box3(new THREE.Vector3(-w - 15, -8, -d - 15), new THREE.Vector3(w + 15, Math.max(270, ...graph.rails.map((rail) => rail.labelPosition[1])) + 25, d + 15));
      fitPoints = graph.rails.flatMap((rail) => [...rail.points, rail.labelPosition]).map((point) => new THREE.Vector3(...point));
      for (const x of [-w - 15, w + 15]) for (const z of [-d - 15, d + 15]) for (const y of [-8, 40]) fitPoints.push(new THREE.Vector3(x, y, z));
      key.position.set(-graph.width * 0.45, graph.width * 0.9, graph.depth * 0.8);
      key.target.position.set(0, 60, 0);
      const shadowSize = Math.max(graph.width, graph.depth) * 0.8;
      Object.assign(key.shadow.camera, { left: -shadowSize, right: shadowSize, top: shadowSize, bottom: -shadowSize, near: 1, far: graph.width * 5 });
      key.shadow.camera.updateProjectionMatrix();
      theta = initialTheta; phi = 0.94; zoom = 1;
      fit();
      container.dataset.nodes = String(graph.nodes.length);
      container.dataset.edges = String(graph.edges.length);
      container.dataset.tracks = String(graph.rails.length);
    },
    select(id) {
      selected = id; halo.visible = Boolean(id);
      const neighbors = new Set([id]);
      for (const edge of graph.edges) if (edge.source === id || edge.target === id) { neighbors.add(edge.source); neighbors.add(edge.target); }
      for (const mesh of meshes) {
        const active = mesh.userData.id === id;
        mesh.scale.setScalar(active ? 1.14 : 1);
        mesh.material.opacity = !id || neighbors.has(mesh.userData.id) ? 1 : 0.38;
        mesh.material.emissive.set(active ? 0x5b3910 : 0);
        if (active) halo.position.copy(mesh.position);
      }
      for (const label of labels) if (label.kind === "file") {
        label.element.classList.toggle("is-related", Boolean(id) && neighbors.has(label.id));
        label.element.textContent = label.id === id ? label.id : label.text;
      }
      makeReferences(id);
      container.dataset.selected = id || "";
      invalidate();
    },
    setLabels(value) { names = value; invalidate(); },
    resetView() { theta = initialTheta; phi = 0.94; zoom = 1; fit(); },
  };
}
