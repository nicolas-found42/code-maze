import { normalsFromHeight } from "./finish-normals.js";

export const PAINT_REPEAT = 32; // Millimetres, shared with the geometry charts.

// A periodic, band-limited authored paint finish. Heights are millimetres;
// roughness uses a separate field rather than treating pigment as relief.
// This is a manufacturing approximation, not a measured material scan.
export function createPaintFinish() {
  const size = 256;
  const heights = new Float32Array(size * size);
  const roughness = new Uint8ClampedArray(size * size * 4);
  function hash(x, y, seed) {
    let h = Math.imul(x + seed, 374761393) ^ Math.imul(y + 17, 668265263);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
  }
  function noise(x, y, count, seed) {
    const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
    const smooth = t => t * t * t * (t * (t * 6 - 15) + 10);
    const u = smooth(fx), v = smooth(fy);
    const at = (a, b) => hash((a + count) % count, (b + count) % count, seed);
    const a = at(ix, iy) * (1 - u) + at(ix + 1, iy) * u;
    const b = at(ix, iy + 1) * (1 - u) + at(ix + 1, iy + 1) * u;
    return (a * (1 - v) + b * v) * 2 - 1;
  }
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const i = y * size + x;
    // Features at 1, 0.5 and 2 mm; smooth spatial support keeps them visible
    // without amplifying independent subpixel noise into a glittering finish.
    heights[i] = 0.040 * noise(x / 8, y / 8, 32, 83)
      + 0.008 * noise(x / 4, y / 4, 64, 199)
      + (0.016 / 3) * noise(x / 16, y / 16, 16, 671);
    const value = Math.round(219 + 12 * noise(x / 16, y / 16, 16, 1221));
    roughness.set([value, value, value, 255], i * 4);
  }
  // Centred differences divide by twice the physical texel pitch.
  const normal = normalsFromHeight(heights, size, size, size / (2 * PAINT_REPEAT));
  return { size, heights, normal, roughness };
}
