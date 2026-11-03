import { normalsFromHeight } from "./finish-normals.js";

export const PLY_HEIGHT = 32;
export const PLY_LAYERS = 21;
export const PLY_REPEAT = 160;
export const PLY_SIZE = 1024;

// Photo-derived hybrid, not an edge scan. The 32 mm / 21-ply fabrication and
// finish parameters are authored; manufacturer references motivate the count.
// Used by the offline baker; the viewer only imports the chart constants.
export function createPlywoodFinish(photo) {
  const width = PLY_SIZE, height = PLY_SIZE, bands = [];
  const color = new Uint8ClampedArray(width * height * 4);
  const heights = new Float32Array(width * height);
  let seed = 82971;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  let total = 0;
  for (let i = 0; i < PLY_LAYERS; i++) {
    const size = 1 + (random() - 0.5) * 0.09;
    total += size; bands.push({ size, tint: (random() - 0.5) * 24, offset: random() * 0.8 });
  }
  let cursor = 0;
  for (const band of bands) {
    band.bottom = cursor; band.size = band.size / total * PLY_HEIGHT;
    cursor += band.size; band.top = cursor;
  }
  const boundaries = Array.from({ length: width }, (_, x) => [0, ...bands.slice(0, -1).map(b => b.top
    + 0.035 * Math.sin((x + 0.5) / width * Math.PI * 2 + b.offset * Math.PI * 2)
    + 0.012 * Math.sin((x + 0.5) / width * Math.PI * 6 + b.offset * Math.PI * 4)), PLY_HEIGHT]);
  const pitchY = PLY_HEIGHT / height;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const mm = (1 - (y + 0.5) / height) * PLY_HEIGHT, u = (x + 0.5) / width;
    const edges = boundaries[x], layer = bands.findIndex((b, i) => mm < edges[i + 1]), band = bands[layer];
    const along = (mm - edges[layer]) / (edges[layer + 1] - edges[layer]);
    // Authored rescaling of face imagery; this cannot recover cut end grain.
    const px = Math.floor((u + band.offset) % 1 * photo.width);
    const py = Math.floor((band.offset + along * 0.018) % 1 * photo.height), p = (py * photo.width + px) * 4;
    const grain = (photo.data[p] * 0.2126 + photo.data[p + 1] * 0.7152 + photo.data[p + 2] * 0.0722 - 220) * 0.8;
    const fine = layer % 2 ? 1.7 * Math.sin(x * 0.63 + y * 0.39) * Math.sin(x * 0.31 - y * 0.77)
      : 1.3 * Math.sin(y * 0.71 + Math.sin(x * 0.016) * 2);
    const distance = Math.min(layer === 0 ? Infinity : mm - edges[layer], layer === PLY_LAYERS - 1 ? Infinity : edges[layer + 1] - mm);
    // 0.06 mm visual bond width, antialiased at this atlas resolution. This is
    // an authored appearance parameter, not a measured cured glue thickness.
    const bond = Math.max(0, Math.min(1, (0.03 + pitchY * 0.5 - distance) / pitchY));
    const base = [217, 195, 156], glue = [139, 111, 76], offset = (y * width + x) * 4;
    for (let c = 0; c < 3; c++) color[offset + c] = (base[c] + band.tint + grain + fine) * (1 - bond) + glue[c] * bond;
    color[offset + 3] = 255;
    // Independent shallow relief; colored photographic pigment is not height.
    const fade = Math.min(1, Math.min(mm, PLY_HEIGHT - mm) / 0.12);
    heights[y * width + x] = y < 2 || y >= height - 2 ? 0 : fade * (
      0.0025 * Math.sin(mm * Math.PI * 2 / 0.35 + Math.sin(u * Math.PI * 16))
      * Math.sin(u * Math.PI * 160) - 0.004 * Math.exp(-((distance / 0.04) ** 2)));
  }
  return { width, height, color, heights, bands,
    normal: normalsFromHeight(heights, width, height, width / (2 * PLY_REPEAT), height / (2 * PLY_HEIGHT)) };
}
