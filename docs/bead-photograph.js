// Photographs the generated model. The map stays interactive underneath while
// diffuse interreflection, area shadows and enamel reflections converge.
// An isolated WebGL context gives this optional, memory-heavy renderer a strict
// lifetime, including allocations upstream v0.0.23's dispose() fails to release.
export function createPhotograph(THREE, container, sourceCamera, getContent, stopMotion) {
  const button = document.getElementById("studio-photo");
  const save = document.getElementById("save-photo");
  const status = document.getElementById("photo-status");
  let generation = 0, renderer, tracer, camera, frame, timer, environment, floor, denoise;
  let active = false;
  const splitGeometries = new Map();
  const photoMaterials = new Map();
  const LIMIT = 256;
  const SCALE = 0.001; // Layout millimetres → optical/path-tracing metres.

  function close(message = "") {
    generation++;
    active = false;
    clearTimeout(timer);
    cancelAnimationFrame(frame);
    frame = timer = undefined;
    // Never call the upstream broken dispose (references _renderQuad). Destroy
    // the owned context instead; shared map textures/geometry remain untouched.
    if (renderer) {
      renderer.domElement.remove();
      renderer.dispose();
      renderer.forceContextLoss();
    }
    environment?.dispose();
    floor?.geometry.dispose(); floor?.material.dispose();
    for (const parts of splitGeometries.values()) for (const geometry of parts) geometry.dispose();
    splitGeometries.clear();
    for (const material of photoMaterials.values()) material.dispose();
    photoMaterials.clear();
    denoise?.material.dispose(); denoise?.dispose(); denoise = undefined;
    renderer = tracer = camera = environment = floor = undefined;
    button.setAttribute("aria-pressed", "false");
    button.textContent = "Studio photo";
    save.hidden = true;
    status.textContent = message;
    container.dataset.photo = "off";
    delete container.dataset.photoSamples;
  }

  function fail() { close("Studio photo unavailable on this device. You can still explore the map."); }

  function size() {
    // Bound memory and shader cost independently of display DPR / huge screens.
    const width = Math.max(1, container.clientWidth), height = Math.max(1, container.clientHeight);
    const ratio = Math.min(devicePixelRatio || 1, 1600 / Math.max(width, height), 2);
    renderer.setPixelRatio(ratio);
    renderer.setSize(width, height);
  }

  function updateCamera() {
    if (!tracer) return;
    camera.copy(sourceCamera);
    camera.position.multiplyScalar(SCALE);
    camera.near *= SCALE; camera.far *= SCALE;
    camera.updateProjectionMatrix();
    // The copied layout has been converted to metres. Keep the toy in focus
    // like a stopped-down product photograph, rather than a miniature diorama.
    camera.fStop = 16;
    camera.focusDistance = camera.position.distanceTo(new THREE.Box3().setFromObject(getContent()).getCenter(new THREE.Vector3()).multiplyScalar(SCALE));
    camera.apertureBlades = 7;
    camera.apertureRotation = 0;
    camera.anamorphicRatio = 1;
    tracer.updateCamera();
    container.dataset.photoSamples = "0";
    save.hidden = true;
    container.dataset.photo = "preparing";
    clearTimeout(timer);
    cancelAnimationFrame(frame);
    // Repeated pointer moves postpone expensive ray work until orbit settles.
    timer = setTimeout(() => { timer = undefined; draw(); }, 180);
  }

  function draw() {
    frame = undefined;
    if (!active || !tracer || document.hidden) return;
    try {
      tracer.renderSample();
      const samples = Math.floor(tracer.samples);
      container.dataset.photoSamples = String(samples);
      if (samples >= 4) {
        renderer.domElement.hidden = false;
        container.dataset.photo = samples >= LIMIT ? "ready" : "rendering";
        save.hidden = false;
      }
      const message = samples >= LIMIT ? "Studio photo ready. Drag to change the angle, or save your photo."
        : samples < 1 ? "Preparing studio photo…" : "Refining studio photo. You can save now, or wait for a cleaner image.";
      if (status.textContent !== message) status.textContent = message;
      if (tracer.samples < LIMIT) frame = requestAnimationFrame(draw);
    } catch { fail(); }
  }

  async function open() {
    close();
    active = true;
    const request = generation;
    button.setAttribute("aria-pressed", "true");
    button.textContent = "Back to map";
    status.textContent = "Preparing studio photo…";
    container.dataset.photo = "preparing";
    stopMotion();
    try {
      const { StudioPathTracer, PhysicalCamera, GradientEquirectTexture, DenoiseMaterial, FullScreenQuad } = await import("./vendor/pathtracer.js");
      if (request !== generation) return;
      renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true, powerPreference: "high-performance" });
      if (!renderer.capabilities.isWebGL2 || !renderer.extensions.has("EXT_color_buffer_float")) { fail(); return; }
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1;
      const gl = renderer.getContext();
      const debug = gl.getExtension("WEBGL_debug_renderer_info");
      const gpu = debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : "";
      // r160's compileAsync polls private material properties even after
      // renderer.dispose clears them. Poll the retained programs instead, and
      // settle every compilation on context loss/cancellation or a deadline.
      const ownedRenderer = renderer;
      renderer.compileAsync = (scene, camera, targetScene) => {
        ownedRenderer.compile(scene, camera, targetScene);
        const programs = [...ownedRenderer.info.programs];
        const deadline = performance.now() + 30000;
        return new Promise((resolve) => {
          function poll() {
            if (!active || request !== generation || gl.isContextLost() || programs.every((program) => program.isReady())) resolve(scene);
            else if (performance.now() > deadline) { resolve(scene); if (request === generation) fail(); }
            else setTimeout(poll, 16);
          }
          poll();
        });
      };
      // Upstream #711: the WebGL coat lobe produces black on Apple GPUs.
      // Use a single dielectric paint interface there (and when the GPU is
      // private). Keep diffuse/specular transport and the original map intact.
      const singleLayer = !gpu || /Apple|Metal/i.test(gpu);
      container.dataset.photoFinish = singleLayer ? "single-layer" : "layered";
      renderer.domElement.className = "photo-canvas";
      renderer.domElement.setAttribute("aria-hidden", "true");
      renderer.domElement.hidden = true;
      renderer.domElement.addEventListener("webglcontextlost", (event) => { event.preventDefault(); if (active && request === generation) fail(); });
      container.append(renderer.domElement);
      size();

      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0xf4f1e9);
      environment = new GradientEquirectTexture(128);
      environment.topColor.set(0xc5d4e3);
      environment.bottomColor.set(0x9d8c75);
      environment.update();
      scene.environment = environment;
      scene.environmentIntensity = 0.22;
      // Clone transforms, preserving the exact generated drilled geometry and
      // material groups. No photo, fixture toy, or replacement model is loaded.
      const model = getContent().clone(true);
      model.scale.multiplyScalar(SCALE);
      for (const child of [...model.children]) if (child.material?.isShadowMaterial) model.remove(child);
      // v0.0.23's scene merger emits one group per mesh, but flattens the
      // material array. Split draws explicitly so paint/bore IDs cannot shift
      // every later mesh (including the floor) to the wrong material.
      const multiMaterial = [];
      model.traverse((mesh) => { if (mesh.isMesh && Array.isArray(mesh.material)) multiMaterial.push(mesh); });
      for (const mesh of multiMaterial) {
        let parts = splitGeometries.get(mesh.geometry);
        if (!parts) {
          parts = mesh.geometry.groups.map(({ start, count }) => {
            const geometry = mesh.geometry.clone();
            geometry.clearGroups();
            if (geometry.index) geometry.setIndex(Array.from(geometry.index.array.slice(start, start + count)));
            else for (const [name, attribute] of Object.entries(geometry.attributes)) {
              geometry.setAttribute(name, new THREE.BufferAttribute(attribute.array.slice(start * attribute.itemSize, (start + count) * attribute.itemSize), attribute.itemSize, attribute.normalized));
            }
            return geometry;
          });
          splitGeometries.set(mesh.geometry, parts);
        }
        const group = new THREE.Group();
        group.position.copy(mesh.position); group.quaternion.copy(mesh.quaternion); group.scale.copy(mesh.scale);
        mesh.geometry.groups.forEach(({ materialIndex }, index) => group.add(new THREE.Mesh(parts[index], mesh.material[materialIndex])));
        mesh.parent.add(group); mesh.removeFromParent();
      }
      model.traverse((mesh) => {
        if (!mesh.isMesh) return;
        let material = photoMaterials.get(mesh.material);
        if (!material) {
          material = mesh.material.clone();
          // Selection is an explanatory overlay, not transparent toy paint.
          material.transparent = false; material.opacity = 1; material.depthWrite = true;
          material.emissive?.set(0);
          if (singleLayer && material.isMeshPhysicalMaterial) {
            material.roughness += (material.clearcoatRoughness - material.roughness) * material.clearcoat;
            material.clearcoat = 0;
          }
          photoMaterials.set(mesh.material, material);
        }
        mesh.material = material;
      });
      scene.add(model);
      const bounds = new THREE.Box3().setFromObject(model);
      const extent = bounds.getSize(new THREE.Vector3());
      const center = bounds.getCenter(new THREE.Vector3());
      const span = Math.max(extent.x, extent.y, extent.z);
      floor = new THREE.Mesh(new THREE.PlaneGeometry(span * 200, span * 200), new THREE.MeshStandardMaterial({ color: 0xf4f1e9, roughness: 0.86 }));
      floor.rotation.x = -Math.PI / 2;
      floor.position.y = bounds.min.y - 0.0005;
      scene.add(floor);
      function softbox(color, intensity, width, height, position) {
        const light = new THREE.RectAreaLight(color, intensity, span * width, span * height);
        light.position.set(center.x + span * position[0], center.y + span * position[1], center.z + span * position[2]);
        light.lookAt(center);
        scene.add(light);
      }
      softbox(0xfff0dc, 5.5, 1.3, 1.1, [-0.8, 1.25, 0.7]);
      softbox(0xddeaff, 2.2, 0.75, 1.2, [1, 0.65, 0.3]);
      softbox(0xffffff, 4, 1.1, 0.7, [0.2, 0.9, -1]);
      camera = new PhysicalCamera();
      tracer = new StudioPathTracer(renderer);
      tracer.bounces = 6;
      tracer.filterGlossyFactor = 0.4;
      tracer.renderDelay = 0;
      tracer.minSamples = 1;
      tracer.fadeDuration = 0;
      tracer.rasterizeScene = false;
      tracer.tiles.set(2, 2);
      tracer.textureSize.set(1024, 1024);
      denoise = new FullScreenQuad(new DenoiseMaterial({ sigma: 2, kSigma: 1, threshold: 0.08 }));
      tracer.renderToCanvasCallback = (target) => {
        denoise.material.map = target.texture;
        denoise.render(renderer);
      };
      tracer.setScene(scene, camera);
      updateCamera();
    } catch { if (request === generation) fail(); }
  }

  button.addEventListener("click", () => { if (active) close(); else open(); });
  save.addEventListener("click", () => {
    const current = renderer;
    if (!current) return;
    current.domElement.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url; link.download = "code-maze-studio.png"; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) { cancelAnimationFrame(frame); frame = undefined; }
    else if (active && tracer && tracer.samples < LIMIT && !frame && !timer) frame = requestAnimationFrame(draw);
  });
  return {
    close,
    cameraChanged() { if (tracer) { renderer.domElement.hidden = true; updateCamera(); } },
    resize() { if (renderer && tracer) { size(); updateCamera(); } },
  };
}
