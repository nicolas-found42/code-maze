"""Add photographic camera characteristics to the Cycles bead-maze render.

Grain, vignette, subtle lateral chromatic aberration, and a gentle warm
grade. Kept deterministic so repeated runs compare cleanly.
"""

import sys

import numpy as np
from PIL import Image, ImageFilter

src = sys.argv[1] if len(sys.argv) > 1 else "docs/bead-maze-render.png"
dst = sys.argv[2] if len(sys.argv) > 2 else "docs/bead-maze-render-final.png"

im = Image.open(src).convert("RGB")
arr = np.asarray(im).astype(np.float32) / 255.0
h, w, _ = arr.shape

# lateral chromatic aberration grows toward the frame edge
yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
cx, cy = (w - 1) / 2.0, (h - 1) / 2.0
r = np.sqrt(((xx - cx) / cx) ** 2 + ((yy - cy) / cy) ** 2)
shift_x = (r**2 * 1.6).astype(np.int32)
for c, direction in ((0, 1), (2, -1)):
    for y in range(h):
        arr[y, :, c] = np.roll(arr[y, :, c], direction * int(shift_x[y].mean()))

# filmic vignette
vig = 1.0 - 0.16 * np.clip(r - 0.35, 0, 1) ** 1.6
arr *= vig[..., None]

# warm grade and gentle S-curve
arr[..., 0] *= 1.012
arr[..., 1] *= 1.004
arr[..., 2] *= 0.985
arr = np.clip(arr, 0, 1)
arr = arr**0.98

# gentle lens bloom around specular highlights
bright = np.clip(arr - 0.82, 0, None)
bloom = np.asarray(
    Image.fromarray((np.clip(bright, 0, 1) * 255).astype(np.uint8)).filter(
        ImageFilter.GaussianBlur(radius=9)
    )
).astype(np.float32) / 255.0
arr = np.clip(arr + bloom * 0.22, 0, 1)

# sensor grain, stronger in the shadows
rng = np.random.default_rng(7)
lum = arr.mean(axis=2, keepdims=True)
sigma = 0.0035 + 0.010 * (1.0 - lum)
grain = rng.normal(0.0, 1.0, (h, w, 1)).astype(np.float32)
arr = np.clip(arr + grain * sigma, 0, 1)

out = Image.fromarray((arr * 255).round().astype(np.uint8))
out = out.filter(ImageFilter.UnsharpMask(radius=1.1, percent=55, threshold=2))
out.save(dst, quality=96)
print(f"wrote {dst}")
