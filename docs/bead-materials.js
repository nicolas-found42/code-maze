import { normalsFromHeight } from "./finish-normals.js";
import { createPaintFinish } from "./paint-finish.js";

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
    map: load("white_maple_veneer_diff_1k.jpg", true),
    normalMap: load("white_maple_veneer_nor_gl_1k.jpg"), normalScale: new THREE.Vector2(0.18, 0.18),
    roughnessMap: load("white_maple_veneer_rough_1k.jpg"),
    color: 0xfff5e5, roughness: 0.66, clearcoat: 0.18, clearcoatRoughness: 0.38, envMapIntensity: 0.45,
  });
  // One repeating tile is one veneer; varying layers are mapped in world units.
  const plyCanvas = document.createElement("canvas");
  plyCanvas.width = 128; plyCanvas.height = 64;
  const ctx = plyCanvas.getContext("2d");
  const image = ctx.createImageData(128, 64);
  const plyHeights = new Float32Array(128 * 64);
  let seed = 7331;
  let reliefSeed = 991;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  for (let y = 0; y < 64; y++) for (let x = 0; x < 128; x++) {
    const seam = y < 5 || y > 60;
    const grain = Math.sin(x * 0.22 + Math.sin(y * 0.08) * 2) * 4 + random() * 9;
    const base = seam ? [145, 105, 63] : [211, 178, 130];
    image.data.set([...base.map((v) => v + grain), 255], (y * 128 + x) * 4);
    // Separately authored micrometre-scale fibre relief and a shallow glue
    // recess. Dark albedo is not used as a displacement measurement.
    const distance = Math.min(y, 64 - y) * 3.25 / 64;
    reliefSeed = (Math.imul(reliefSeed, 1664525) + 1013904223) >>> 0;
    plyHeights[y * 128 + x] = Math.sin(x * 0.22 + Math.sin(y * 0.08) * 2) * 0.004
      + reliefSeed / 4294967296 * 0.006 - 0.015 * Math.exp(-((distance / 0.08) ** 2));
  }
  ctx.putImageData(image, 0, 0);
  const plyMap = new THREE.CanvasTexture(plyCanvas);
  plyMap.colorSpace = THREE.SRGBColorSpace;
  plyMap.wrapS = plyMap.wrapT = THREE.RepeatWrapping;
  plyMap.anisotropy = anisotropy;
  function normalTexture(data, width, height) {
    const canvas = document.createElement("canvas");
    canvas.width = width; canvas.height = height;
    const context = canvas.getContext("2d"), pixels = context.createImageData(width, height);
    pixels.data.set(data); context.putImageData(pixels, 0, 0);
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.anisotropy = anisotropy;
    return texture;
  }
  const plyNormal = normalTexture(normalsFromHeight(plyHeights, 128, 64, 128 / (2 * 420), 64 / (2 * 3.25)), 128, 64);
  const ply = new THREE.MeshStandardMaterial({ map: plyMap, roughness: 0.68,
    normalMap: plyNormal, normalScale: new THREE.Vector2(1, 1) });

  const finish = createPaintFinish();
  const paintCanvas = document.createElement("canvas");
  paintCanvas.width = paintCanvas.height = finish.size;
  const paintContext = paintCanvas.getContext("2d");
  const paintPixels = paintContext.createImageData(finish.size, finish.size);
  paintPixels.data.set(finish.roughness);
  paintContext.putImageData(paintPixels, 0, 0);
  const paintTexture = new THREE.CanvasTexture(paintCanvas);
  paintTexture.wrapS = paintTexture.wrapT = THREE.RepeatWrapping;
  paintTexture.anisotropy = anisotropy;
  const paintNormal = normalTexture(finish.normal, finish.size, finish.size);
  const boreMap = load("fine_grained_wood_col_1k.jpg", true);
  const bore = new THREE.MeshStandardMaterial({ color: 0xc49b67, map: boreMap, roughness: 0.78 });
  return {
    wood, ply,
    bead(color) {
      return [new THREE.MeshPhysicalMaterial({ color, roughness: 0.46, metalness: 0,
        clearcoat: 0.24, clearcoatRoughness: 0.21, envMapIntensity: 0.55,
        normalMap: paintNormal, normalScale: new THREE.Vector2(1, 1), roughnessMap: paintTexture }), bore.clone()];
    },
    wire(color) { return new THREE.MeshPhysicalMaterial({ color, roughness: 0.23, metalness: 0.05,
      clearcoat: 0.45, clearcoatRoughness: 0.17, envMapIntensity: 0.35 }); },
  };
}
