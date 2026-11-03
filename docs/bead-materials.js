import { createPaintFinish } from "./paint-finish.js";
import { PLY_SIZE } from "./plywood-finish.js";

export function createToyMaterials(THREE, renderer, invalidate) {
  const loader = new THREE.TextureLoader();
  const pending = [];
  const anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  function load(name, color = false, fallback = [255, 255, 255, 255]) {
    let settled, finished = false, fallbackImage;
    pending.push(new Promise(resolve => { settled = resolve; }));
    const changed = () => {
      if (finished) {
        // TextureLoader assigns its image before this callback. A late image
        // must not replace the stable fallback already packed by a photo.
        if (fallbackImage) { texture.image = fallbackImage; texture.needsUpdate = true; }
        return;
      }
      finished = true; clearTimeout(deadline); settled(); invalidate();
    };
    const failed = () => {
      if (finished) return;
      // Keep both renderers usable with valid neutral pixels after an asset
      // error; never send an uninitialized image into the tracer's atlas.
      const canvas = document.createElement("canvas"); canvas.width = canvas.height = 1;
      const context = canvas.getContext("2d"), pixel = context.createImageData(1, 1);
      pixel.data.set(fallback); context.putImageData(pixel, 0, 0);
      fallbackImage = canvas; texture.image = canvas; texture.needsUpdate = true; changed();
    };
    const texture = loader.load(`./vendor/${name}`, changed, undefined, failed);
    const deadline = setTimeout(failed, 15000);
    if (color) texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.anisotropy = anisotropy;
    return texture;
  }
  const wood = new THREE.MeshPhysicalMaterial({
    map: load("white_maple_veneer_diff_1k.jpg", true),
    normalMap: load("white_maple_veneer_nor_gl_1k.jpg", false, [128, 128, 255, 255]), normalScale: new THREE.Vector2(0.18, 0.18),
    roughnessMap: load("white_maple_veneer_rough_1k.jpg"),
    color: 0xfff5e5, roughness: 0.66, clearcoat: 0.18, clearcoatRoughness: 0.38, envMapIntensity: 0.45,
  });
  const plyMap = load("birch_ply_edge_color_1k.png", true, [217, 195, 156, 255]);
  const plyNormal = load("birch_ply_edge_normal_1k.png", false, [128, 128, 255, 255]);
  for (const texture of [plyMap, plyNormal]) {
    texture.wrapT = THREE.ClampToEdgeWrapping;
    // The pinned tracer's packed array always repeats. Keep both renderers
    // between edge texel centres so filtering cannot borrow the opposite ply.
    texture.repeat.y = (PLY_SIZE - 1) / PLY_SIZE;
    texture.offset.y = 0.5 / PLY_SIZE;
  }
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
    wood, ply, ready: Promise.all(pending),
    bead(color) {
      return [new THREE.MeshPhysicalMaterial({ color, roughness: 0.46, metalness: 0,
        clearcoat: 0.24, clearcoatRoughness: 0.21, envMapIntensity: 0.55,
        normalMap: paintNormal, normalScale: new THREE.Vector2(1, 1), roughnessMap: paintTexture }), bore.clone()];
    },
    wire(color) { return new THREE.MeshPhysicalMaterial({ color, roughness: 0.23, metalness: 0.05,
      clearcoat: 0.45, clearcoatRoughness: 0.17, envMapIntensity: 0.35 }); },
  };
}
