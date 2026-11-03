// A CanvasTexture uploads with flipY=true: increasing texture-v moves toward
// smaller image rows. Its tangent normal therefore uses +dHeight/dRow for Y.
export function normalsFromHeight(heights, width, height, strength = 0.6) {
  const data = new Uint8ClampedArray(width * height * 4);
  const at = (x, y) => heights[((y + height) % height) * width + (x + width) % width];
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const nx = (at(x - 1, y) - at(x + 1, y)) * strength;
    const ny = (at(x, y + 1) - at(x, y - 1)) * strength;
    const length = Math.hypot(nx, ny, 1);
    data.set([Math.round((nx / length + 1) * 127.5), Math.round((ny / length + 1) * 127.5), Math.round((1 / length + 1) * 127.5), 255], (y * width + x) * 4);
  }
  return data;
}
