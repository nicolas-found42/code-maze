import { readLinearImage } from "./photo-denoising.js";

// Clean primary-hit features from the same generated mesh and camera. The
// neural model expects linear albedo and encoded [0,1] shading normals, with
// matching top-row-first orientation. Four coverage samples soften silhouettes.
export function renderPhotoGuides(THREE, renderer, scene, camera, width, height) {
  const target = new THREE.WebGLRenderTarget(width, height, { type: THREE.HalfFloatType, samples: 4 });
  const state = { toneMapping: renderer.toneMapping, colorSpace: renderer.outputColorSpace,
    target: renderer.getRenderTarget(), autoClear: renderer.autoClear };
  const originals = new Map(), materials = new Map();
  scene.traverse((mesh) => {
    if (!mesh.isMesh) return;
    const base = mesh.material;
    originals.set(mesh, base);
    if (!materials.has(base)) materials.set(base, {
      albedo: new THREE.MeshBasicMaterial({ color: base.color, map: base.map, side: base.side, vertexColors: base.vertexColors, toneMapped: false }),
      normal: new THREE.MeshNormalMaterial({ normalMap: base.normalMap ?? null,
        normalScale: base.normalScale?.clone() ?? new THREE.Vector2(1, 1),
        bumpMap: base.bumpMap ?? null, bumpScale: base.bumpScale ?? 1,
        side: base.side, flatShading: base.flatShading, toneMapped: false }),
    });
  });
  try {
    renderer.toneMapping = THREE.NoToneMapping;
    renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    renderer.autoClear = true;
    const output = {};
    for (const key of ["albedo", "normal"]) {
      for (const [mesh, base] of originals) mesh.material = materials.get(base)[key];
      renderer.setRenderTarget(target);
      renderer.render(scene, camera);
      output[key] = readLinearImage(renderer, target, { ArrayType: Uint16Array, decode: THREE.DataUtils.fromHalfFloat });
    }
    return output;
  } finally {
    for (const [mesh, base] of originals) mesh.material = base;
    renderer.setRenderTarget(state.target);
    renderer.toneMapping = state.toneMapping;
    renderer.outputColorSpace = state.colorSpace;
    renderer.autoClear = state.autoClear;
    target.dispose();
    for (const { albedo, normal } of materials.values()) { albedo.dispose(); normal.dispose(); }
  }
}
