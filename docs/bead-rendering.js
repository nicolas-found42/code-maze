// Optional specialist shading. A rejected import or unsupported GPU retains the
// direct renderer, so the scan, picking and keyboard flows remain usable.
export async function createStudioRendering(THREE, renderer, scene, camera, container, invalidate) {
  const { EffectComposer, RenderPass, N8AOPostPass, FullScreenTriangle, EffectPass, ToneMappingEffect, ToneMappingMode, FXAAEffect, RoomEnvironment } = await import("./vendor/fidelity.js");
  const room = new RoomEnvironment(renderer);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const environment = pmrem.fromScene(room, 0.04);
  scene.environment = environment.texture;
  room.dispose(); pmrem.dispose();
  container.dataset.lighting = "studio";
  invalidate();
  if (!renderer.capabilities.isWebGL2 || !renderer.extensions.has("EXT_color_buffer_float")) return null;
  const composer = new EffectComposer(renderer, { frameBufferType: THREE.HalfFloatType, multisampling: 4 });
  const ao = new N8AOPostPass(scene, camera);
  function dispose() {
    // postprocessing's Pass.dispose is shallow; N8AO owns custom fullscreen
    // triangles which it does not recognize. Release those on pipeline failure.
    const quads = Object.values(ao).filter((value) => value instanceof FullScreenTriangle);
    composer.dispose();
    for (const quad of quads) quad.dispose();
    renderer.autoClear = true;
    renderer.setRenderTarget(null);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
  }
  let preset;
  function quality(width) {
    const next = width >= 700 ? "Neural-Medium" : "Low";
    if (next === preset) return;
    preset = next;
    ao.setQualityMode(preset);
    container.dataset.denoising = ao.configuration.neuralDenoise ? "neural" : "poisson";
  }
  quality(container.clientWidth);
  Object.assign(ao.configuration, { aoRadius: 20, intensity: 1.5, distanceFalloff: 1,
    biasOffset: 0.8, biasMultiplier: 1, gammaCorrection: false, accumulate: false, transparencyAware: true });
  try {
    composer.addPass(new RenderPass(scene, camera));
    composer.addPass(ao);
    composer.addPass(new EffectPass(camera, new ToneMappingEffect({ mode: ToneMappingMode.ACES_FILMIC }), new FXAAEffect()));
  } catch (error) {
    dispose();
    throw error;
  }
  renderer.toneMapping = THREE.NoToneMapping;
  container.dataset.shading = "n8ao";
  return {
    render() { composer.render(0); },
    resize(width, height) { quality(width); composer.setSize(width, height); },
    // The studio environment belongs to the viewer, not an individual graph.
    dispose,
  };
}
