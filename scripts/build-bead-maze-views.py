"""Build the three-view image-based capture assets.

For each real product photograph:
  - remove the background (BRIA RMBG 2.0 through rembg)
  - crop to the toy and pad to a square
  - estimate monocular depth (Depth Anything V2 Small)
  - build a background plate that keeps the real shadow

Outputs live beside the page so the browser can load them directly.
"""

import os
import numpy as np
from PIL import Image, ImageFilter
from rembg import remove
from transformers import pipeline
import torch

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
VIEWS = os.path.join(ROOT, "docs", "bead-maze", "views")
OUT = os.path.join(ROOT, "docs")
SIZE = 1600
NAMES = ["threequarter", "top", "front"]


def square_crop(rgb, alpha, pad=0.06):
    bbox = alpha.getbbox()
    x0, y0, x1, y1 = bbox
    side = max(x1 - x0, y1 - y0)
    grow = int(side * pad)
    cx, cy = (x0 + x1) // 2, (y0 + y1) // 2
    half = side // 2 + grow
    left, top = cx - half, cy - half
    box = (left, top, left + 2 * half, top + 2 * half)
    canvas_rgb = Image.new("RGB", (2 * half, 2 * half), (255, 255, 255))
    canvas_a = Image.new("L", (2 * half, 2 * half), 0)
    canvas_rgb.paste(rgb.crop(box), (0, 0))
    canvas_a.paste(alpha.crop(box), (0, 0))
    return canvas_rgb, canvas_a


def main():
    device = "mps" if torch.backends.mps.is_available() else "cpu"
    depth_pipe = pipeline(
        "depth-estimation",
        model="depth-anything/Depth-Anything-V2-Small-hf",
        device=device,
    )
    for name in NAMES:
        src = os.path.join(VIEWS, f"{name}.jpg")
        image = Image.open(src).convert("RGBA")
        cut = remove(image)
        rgb = image.convert("RGB")
        alpha = cut.getchannel("A")
        rgb, alpha = square_crop(rgb, alpha)
        rgb = rgb.resize((SIZE, SIZE), Image.LANCZOS)
        alpha = alpha.resize((SIZE, SIZE), Image.LANCZOS)
        rgba = rgb.copy()
        rgba.putalpha(alpha)
        rgba.save(os.path.join(OUT, f"bead-maze-view-{name}.png"))

        depth = depth_pipe(rgb)["depth"].resize((SIZE, SIZE), Image.BILINEAR)
        depth.save(os.path.join(OUT, f"bead-maze-view-{name}-depth.png"))

        mask = alpha.point(lambda a: 255 if a > 40 else 0).filter(ImageFilter.MaxFilter(11))
        inv = mask.point(lambda a: 255 - a)
        plate = Image.new("RGB", rgb.size, (255, 255, 255))
        plate.paste(rgb, (0, 0), inv)
        plate.save(os.path.join(OUT, f"bead-maze-view-{name}-backdrop.jpg"), quality=94)
        print(f"{name}: matte {int((np.asarray(alpha) > 40).sum())}px")


if __name__ == "__main__":
    main()
