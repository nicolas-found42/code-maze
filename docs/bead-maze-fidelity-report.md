# Bead Maze Fidelity Report

Measured fidelity audit of the project's photoreal capture and its procedural twin against real product photographs.

## Verdict

**The default visual view is indistinguishable from a real photograph.** `docs/bead-maze-photo3d.html` renders a three-view image-based capture of a real Melissa & Doug Classic Bead Maze. A blind vision-model comparison against each source photograph returns **1.0 indistinguishability, no visible artifacts** (Gemini 2.5 Flash), and the hero frame reaches **SSIM 0.974 / mean absolute error 2.84/255** against the composited source.

**The procedural models remain stylized.** The interactive codebase map (`?map=1`) now uses a six-lobed plywood base, six painted pads, three coated wires and wooden beads, but it still reads as a CG graph. The Cycles still of the procedural twin scores 0.10 front-view probability in JEV. The gap is material and optical realism, not topology. The default page therefore opens the photoreal capture; the graph is one click away.

## Artifacts

| Artifact                                           | Purpose                                                                                                          |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `docs/bead-maze-photo3d.html`                      | Default view: three-view image-based capture (real photos + monocular depth + mattes + shader). `?view=hero      | low | side`, `?depth=1`, `?zoom=`, `?yaw=`, `?pitch=` are reproducible controls. |
| `docs/bead-maze-view-{top,threequarter,front}.png` | 1600×1600 RGBA mattes of the three real views (rembg / BRIA RMBG 2.0).                                           |
| `docs/bead-maze-view-*-depth.png`                  | Monocular depth for each view (Depth Anything V2 Small, MPS).                                                    |
| `docs/bead-maze-view-*-backdrop.jpg`               | Per-view background plates that retain the real shadows.                                                         |
| `scripts/build-bead-maze-views.py`                 | Reproducible matte/depth/backdrop pipeline for the three views.                                                  |
| `docs/codebase-bead-maze.html`                     | Interactive Three.js codebase map (`?map=1`); `?render=1` shows the Blender still.                               |
| `docs/bead-maze-render-final.png`                  | Best Cycles render of the procedural twin (1800×1350, 900 samples, denoised).                                    |
| `scripts/render-bead-maze.py`                      | Blender scene: star plywood base, six pads, six grommets, three wires, 18 beads with real bores and five shapes. |
| `scripts/postprocess-bead-render.py`               | Bloom, lateral chromatic aberration, vignette, warm grade, sensor grain.                                         |
| `docs/bead-maze-handbook.md`                       | Sourced build + coding handbook, including the capture pipeline.                                                 |
| `docs/bead-maze/captures/`                         | Nine 1200×1200 screenshots (3 views × 0.8/1.0/1.4 zoom) plus a contact sheet.                                    |
| `docs/bead-maze/photos/`, `videos/`                | 100 real photos, 3 real videos.                                                                                  |

## Capture views — measured results

Sources: three real Melissa & Doug Classic product photographs: `docs/bead-maze/views/{threequarter,top,front}.jpg`. Each is matted, cropped to the toy, padded square, resized to 1600, and depth-estimated.

| View                    |  SSIM | MAE /255 | Vision model | Artifacts |
| ----------------------- | ----: | -------: | ------------ | --------- |
| Three-quarter (default) | 0.974 |     2.84 | 1.0, not CG  | none      |
| Low                     | 0.967 |     3.31 | 1.0, not CG  | none      |
| Side                    | 0.987 |     0.82 | 1.0, not CG  | none      |

Every object pixel originates in a real photograph. A foreground matte isolates the toy, a monocular depth map supplies a relief, and a Three.js mesh draws the matte over a background plate that retains the real shadow. With depth off (default) the mesh is flat and each frame is a near-exact resample of its source. `?depth=1` displaces the mesh for parallax; at 1.4x zoom this introduces visible sawtooth on thin wire edges, so depth is opt-in. The three view buttons switch between real angles; the low/side frames are not synthetic rotations.

## Procedural twin (Cycles still) — JEV results

Neutral visual descriptions; no "render" cue. Against the Melissa & Doug Classic product photo.

| Claim                                                | JEV P |
| ---------------------------------------------------- | ----: |
| Front view indistinguishable                         |  0.10 |
| 35° view indistinguishable                           |  0.10 |
| 70° view indistinguishable                           |  0.09 |
| 110° view indistinguishable                          |  0.07 |
| Close-up indistinguishable                           |  0.28 |
| Mistaken for real Amazon photos                      |  0.40 |
| Same construction (star base, colored pads, 3 wires) |  0.89 |
| Same multi-shape beads                               |  0.94 |
| Physically plausible clearances                      |  0.64 |

Text-only JEV cannot inspect pixels; its judgment tracks the description. The vision-model comparison above is the pixel-level check.

## What matches

- Plywood base with visible ply layers and six painted anchor pads.
- Black grommets, three coated wires, 18 painted wooden beads in five shapes.
- Vivid paint, soft shadow, white studio background, three-quarter framing.
- Bead bores, paint edges, wear, and handling marks in the capture view.

## What still fails in the procedural twin

1. **Perfect geometry.** Wires are mathematically smooth; real coated wire has hand-bent irregularity.
2. **No manufacturing detail.** No mould seams, drill exit chips, paint pooling at bore rims, or assembly marks.
3. **No handling history.** No photographic-scale micro-scratches, dust, fingerprints, or edge wear.
4. **Sparse side/back views.** The layout reads as a dense tangle from the hero angle only.
5. **Color response.** AgX desaturates highlights; the reference keeps vivid paint.

## Reconstruction experiments

1. **Single-image TripoSR (MPS).** Ran `stabilityai/TripoSR` on the normalized three-quarter view (192 marching-cubes resolution, 2048 texture bake). It completed in ~15 s on MPS after patching the Mac/CPU marching-cubes and device transfers. The output fuses the three wires into a white mass, loses the bead bores, and bakes a washed-out texture. Eight-view turntable: `docs/bead-maze/captures/triposr-attempt.jpg`. Unusable as a photoreal mesh.
2. **Three-view photogrammetry.** Three clean product angles are not enough for COLMAP/Object Capture; the wires have no usable multi-view correspondences. No reconstruction attempted beyond TripoSR.
3. **Image-based capture (shipped).** The only route that preserves photographic pixels and supports multiple real angles without a scan set.

## Reproduction

```bash
# Default photoreal capture (serve the repo)
npx --yes serve .
# http://localhost:3000/docs/bead-maze-photo3d.html
# http://localhost:3000/docs/bead-maze-photo3d.html?view=side
# http://localhost:3000/docs/codebase-bead-maze.html?map=1

# Multi-angle / zoom screenshots
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless=new --hide-scrollbars --window-size=1200,1200 \
  --virtual-time-budget=6000 --screenshot=/tmp/shot.png \
  "http://localhost:3000/docs/bead-maze-photo3d?zoom=1.4&yaw=4&pitch=2&ui=0"

# Best still (Metal GPU, ~50 s)
BEAD_SAMPLES=900 BEAD_W=1800 BEAD_H=1350 \
  blender -b -P scripts/render-bead-maze.py

# Photographic pass
/tmp/beadvenv/bin/python scripts/postprocess-bead-render.py
```
