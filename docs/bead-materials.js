export function createToyMaterials(THREE, renderer, invalidate) {
  const loader = new THREE.TextureLoader();
  const anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  function load(name, color = false) {
    const texture = loader.load(`./vendor/${name}`, invalidate, undefined, invalidate);
    if (color) texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.anisotropy = anisotropy;
    return texture;
  }
  const wood = new THREE.MeshPhysicalMaterial({
    map: load("ash_veneer_diff_1k.jpg", true),
    normalMap: load("ash_veneer_nor_gl_1k.jpg"), normalScale: new THREE.Vector2(0.18, 0.18),
    roughnessMap: load("ash_veneer_rough_1k.jpg"),
    color: 0xd1ad7d, roughness: 0.72, clearcoat: 0.18, clearcoatRoughness: 0.38, envMapIntensity: 0.45,
  });
  // One repeating tile is one veneer; varying layers are mapped in world units.
  const plyCanvas = document.createElement("canvas");
  plyCanvas.width = 128; plyCanvas.height = 64;
  const ctx = plyCanvas.getContext("2d");
  const image = ctx.createImageData(128, 64);
  let seed = 7331;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  for (let y = 0; y < 64; y++) for (let x = 0; x < 128; x++) {
    const seam = y < 5 || y > 60;
    const grain = Math.sin(x * 0.22 + Math.sin(y * 0.08) * 2) * 4 + random() * 9;
    const base = seam ? [145, 105, 63] : [211, 178, 130];
    image.data.set([...base.map((v) => v + grain), 255], (y * 128 + x) * 4);
  }
  ctx.putImageData(image, 0, 0);
  const plyMap = new THREE.CanvasTexture(plyCanvas);
  plyMap.colorSpace = THREE.SRGBColorSpace;
  plyMap.wrapS = plyMap.wrapT = THREE.RepeatWrapping;
  plyMap.anisotropy = anisotropy;
  const ply = new THREE.MeshStandardMaterial({ map: plyMap, roughness: 0.68, bumpMap: plyMap, bumpScale: 0.12 });

  // Seeded orange-peel finish with faint, wandering timber fibres. Unlike the
  // old arithmetic pixel stripe, adjacent rows have independent fine structure.
  const paintCanvas = document.createElement("canvas");
  paintCanvas.width = paintCanvas.height = 256;
  const paintContext = paintCanvas.getContext("2d");
  const paintPixels = paintContext.createImageData(256, 256);
  for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) {
    const fibre = Math.sin(x * 0.58 + Math.sin(y * 0.045) * 1.2) * 6;
    const value = Math.round(195 + fibre + random() * 35);
    paintPixels.data.set([value, value, value, 255], (y * 256 + x) * 4);
  }
  paintContext.putImageData(paintPixels, 0, 0);
  const paintTexture = new THREE.CanvasTexture(paintCanvas);
  paintTexture.wrapS = paintTexture.wrapT = THREE.RepeatWrapping;
  paintTexture.anisotropy = anisotropy;
  const boreMap = load("fine_grained_wood_col_1k.jpg", true);
  const bore = new THREE.MeshStandardMaterial({ color: 0xc49b67, map: boreMap, roughness: 0.78 });
  return {
    wood, ply,
    bead(color) {
      return [new THREE.MeshPhysicalMaterial({ color, roughness: 0.58, metalness: 0,
        clearcoat: 0.24, clearcoatRoughness: 0.3, envMapIntensity: 0.55,
        bumpMap: paintTexture, bumpScale: 0.025, roughnessMap: paintTexture }), bore.clone()];
    },
    wire(color) { return new THREE.MeshPhysicalMaterial({ color, roughness: 0.29, metalness: 0.05,
      clearcoat: 0.45, clearcoatRoughness: 0.22, envMapIntensity: 0.35 }); },
  };
}
