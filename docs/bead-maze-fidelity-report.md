# Historical Bead Maze Capture Experiments

Historical measurements of the fixed photographic companion and its separate procedural twin. These results do **not** establish photographic fidelity of generated codebase mazes.

## Current generated viewer — 2026-11-03

The default entry point opens the generated codebase map. **Studio photo** progressively traces that map's actual drilled meshes, materials and camera with diffuse interreflection and rectangular studio lights. The image-based companion below is a separate reference; it does not represent generated files or tracks. No blind photographic equivalence test of the current generated viewer has passed. This remains an open acceptance requirement.

The 30-file fixture before the surrounding studio sweep and coating-scale correction: [earlier interactive preview](maze-fidelity/studio-preview.jpg) · [converged guided studio photograph](maze-fidelity/studio.png) · [1600-pixel close-up](maze-fidelity/studio-close.png). Modeling, placement and materials also changed, so this is not an isolated denoiser comparison or a blind comparison against a real toy. The photographs use the Apple single-layer finish described in [the tool notes](vendor/fidelity-libraries.md). The photographic suite writes fresh hero, close, low and mobile captures to `.scratch/verification/photographic/`.

The [paint-finish close capture at 50c57a2](maze-fidelity/paint-finish-close.png) uses supported poses, the surrounding sweep and an authored periodic paint height field. Surface variation remains visible after 256 samples and guided OIDN, unlike the prior subpixel noise. The newer [plywood-stack low capture](maze-fidelity/plywood-stack-low.png) uses a full-stack hybrid edge material. Both still read as renders; the full photographic requirement remains open. Captured-HDRI experiments were evaluated and rejected for this production stage, as documented in [the lighting research](maze-3d-tools-research.md#photographed-studio-illumination--evaluated-not-adopted).

## Selected Persona

- **Name & Archetype:** Mara, supplied master toy modeler and mechanical engineer, resuming the existing fidelity review.
- **Environment & Constraints:** Chrome 156, ANGLE Metal, Apple M5 Pro; Blender 5.2.2 LTS for the offline illustration. Generated files must remain actual bead meshes with real bores and local offline assets.
- **Picky Obsessions:** Physical drill clearance; convincing paint, wood and lighting; arbitrary generated scenes rather than photographic substitutions; justified specialist tools; recovery without GPU leaks. These retain the established ledger profile and the user's demand for photographic indistinguishability.
- **Tool Attack Plan:** Fixed-camera generated captures, rendered paint-color probes, real PNG export, context-loss/cancellation tests, mobile and 600-file scenes, Blender bore rays/material inspection, and REA controlled browser observation.

## Run Scope and Baseline

- **Scope & Exclusions:** Generated geometry, materials, photographic export, shared interaction/static integration, tool provenance and claims. Also audit the offline illustration's bores and bead kinds. Scanner semantics and reconstruction of the separate historical photo companion are excluded from implementation; neither exclusion reduces the original photographic acceptance requirement.
- **Review Surfaces:** Modeling, rendering and integration, retaining the existing ledger.
- **Ledger:** `/private/tmp/code-maze-fidelity-review/review.json`, iteration 5. Earlier iterations and logs remain there.
- **Baseline:** Clean worktree at `3509842`; existing generated close image still showed directional hard shadows and synthetic shading. The older report's photo-resampling verdict did not certify generated geometry.

## Iteration 5

### Adversarial Review

#### ISS-5.01 — Generated photographic equivalence remains unproven

- **Severity:** HIGH
- **Location:** Generated scene, `docs/bead-rendering.js` and `docs/bead-photograph.js`.
- **Tool Evidence:** Baseline `docs/maze-fidelity/after.jpg` versus the generated studio images. Indirect light, gloss and contact improve; fully converged hero/close/mobile images now use guided OIDN. No fresh multi-angle blind comparison establishes the requested equivalence. Manufacturing and material detail still require visual scrutiny.
- **Persona Critique:** A clean shader, attractive screenshot or real-photo companion cannot substitute for the requested generated result.
- **Acceptance Criterion:** Generated mazes withstand photographic comparison across overview, close, low and mobile views. **Open.** The goal remains active; no clean review or completion gate is claimed.

#### ISS-5.02 — Historical resampling results misrepresented current fidelity

- **Severity:** HIGH
- **Location:** This report's former verdict.
- **Tool Evidence:** It called the default view indistinguishable while comparing real source photos to their resamples; the current default opens the generated graph.
- **Persona Critique:** Those numbers measure photographic resampling, not model fidelity.
- **Acceptance Criterion:** Label historical results and state the current generated-scene limitations.

#### ISS-5.03 — Optional tracer produced black and misassigned materials

- **Severity:** HIGH
- **Location:** `docs/bead-photograph.js`, pinned pathtracer scene merger and coat shader.
- **Tool Evidence:** Initial generated captures had shuffled paint/timber IDs and black physical materials without shader errors. Upstream [issue 711](https://github.com/gkjohnson/three-gpu-pathtracer/issues/711) reports matching Apple clearcoat behavior.
- **Persona Critique:** Compilation alone cannot certify an image.
- **Acceptance Criterion:** Correct lit RGB paint/timber, actual mesh export, and recovery/cleanup checks.

#### ISS-5.04 — Offline illustration had zero drill clearance and no cylinder kind

- **Severity:** MEDIUM
- **Location:** `scripts/render-bead-maze.py`, `bore`, `bead`, `add_beads`.
- **Tool Evidence:** Bore radius equaled wire radius despite a 1.2 mm offset; `cylinder` fell through to sphere; every face was assigned paint.
- **Persona Critique:** The illustration could not validate manufactured drill clearance or bore timber.
- **Acceptance Criterion:** Distinct cylinder, open bores, paint/timber faces and positive eccentric radial clearance, verified in Blender.

#### ISS-5.05 — Late context-loss event cancelled a newer photograph

- **Severity:** MEDIUM
- **Location:** `docs/bead-photograph.js`, context-loss listener.
- **Tool Evidence:** The focused stale-context probe failed: close/reopen followed by the previous canvas's lost-context event reset the new session's button to false.
- **Persona Critique:** Disposed GPU work must not cancel the next request.
- **Acceptance Criterion:** A stale event retains the new session and its samples continue.

#### ISS-5.06 — Paint normal Y slope disagreed with its height field

- **Severity:** MEDIUM
- **Location:** `docs/bead-materials.js`.
- **Tool Evidence:** CanvasTexture flips image rows; tangent normal Y therefore uses the positive row-height derivative. The earlier generator used its negative. The source/math hypothesis was independently classified as an observable defect by Jev, P=0.98.
- **Persona Critique:** Height, roughness and raking highlights must describe the same finish.
- **Acceptance Criterion:** Decoded normals agree with analytic texture-UV gradients on both axes and periodic boundaries.

#### ISS-5.07 — Low-sample captures did not establish final close-up quality

- **Severity:** MEDIUM
- **Location:** `docs/bead-photograph.js`, photographic validation.
- **Tool Evidence:** Earlier close/mobile evidence stopped at 32/8 samples despite a 256-sample cap. A converged baseline showed matte synthetic response; color-only neural refinement smoothed surface detail.
- **Persona Critique:** Judge the finished image and preserve material detail while removing Monte Carlo noise.
- **Acceptance Criterion:** Fully converged overview/close/mobile captures, aligned linear guides, actual mesh-based HDR refinement and readiness after the available final pass.

#### ISS-5.08 — Curved support tubes intersected their own beads

- **Severity:** HIGH
- **Location:** `docs/bead-layout.js`.
- **Tool Evidence:** Independent triangle/BVH intersection found three clipped beads in the 240-file fixture and a failure in the 600-file fixture. Existing clearance tests skipped each bead's own rail.
- **Persona Critique:** Coated steel must pass through the drill, not through timber.
- **Acceptance Criterion:** Preserve all nodes and weave/spacing while actual bead shells clear their own tubes at 30/240/600 files.

#### ISS-5.09 — Bundled Float16 dependency lacked its license notice

- **Severity:** LOW
- **Location:** `docs/vendor/oidn.js`, asset builder.
- **Tool Evidence:** The OIDN bundle includes MIT-licensed `@petamoriken/float16` 3.9.3 but had neither its author's notice in the bundle nor a separate license copy.
- **Persona Critique:** Retain the notices of the specialist code being redistributed.
- **Acceptance Criterion:** Copy the upstream notice during rebuilding, record the version and serve the license in the static export.

#### ISS-5.10 — Low-angle photographs exposed an artificial horizon

- **Severity:** HIGH
- **Location:** `docs/bead-photograph.js`, studio floor.
- **Tool Evidence:** A fresh 256-sample/OIDN low view showed a sharp floor/background boundary across the entire frame. Clear background bands measured a largest adjacent-row RGB brightness step of 42.25 on the 0–255 scale. Hero and close captures had not exposed this angle.
- **Persona Critique:** An arbitrary-view product photograph must not reveal a floor/sky cut when the camera orbits lower.
- **Acceptance Criterion:** Continuous low-angle studio background with actual converged captures, preserved guide alignment, export and cleanup.

#### ISS-5.11 — A shared coating stretched differently across bead forms

- **Severity:** MEDIUM
- **Location:** `docs/bead-geometry.js`, native shape UVs.
- **Tool Evidence:** The same 256px paint normal/roughness maps covered normalized shape UVs. Independent painted-triangle area/UV-area measurements gave area-weighted median lengths per repeat of 91.70, 30.38, 114.80, 90.86 and 95.04 mm for sphere, block, barrel, ring and spool. Unequal lathe meridian segments also received equal texture intervals. The new regression failed on the original geometry.
- **Persona Critique:** One manufactured coating should not change its fine-structure scale by nearly four times between a block and a turned bead.
- **Acceptance Criterion:** Declare a physical coating repeat, retain closed texture phase around turned forms, preserve geometry/bores/normals and inspect fresh finished captures. This does not imply that the chosen finish is physically measured from a real toy.

#### ISS-5.12 — Loose beads floated centrally inside their bores

- **Severity:** MEDIUM
- **Location:** Axis placement in `docs/bead-layout.js` and final mesh poses.
- **Tool Evidence:** Before the seating pass, actual triangle distance for near-horizontal block `f5` was 2.15423 mm to its own wire, with tangent Y 0.09652 and lowest point 62.75 mm above a base top at 37 mm. The necessary-contact reproduction failed. The 30/240-file probes found positive own-wire gaps of roughly 0.6–2.2 mm throughout.
- **Persona Critique:** For an ordinary passive wooden bead without hidden adhesive or magnetic support, a generous drilled clearance does not hold it in mid-air.
- **Acceptance Criterion:** Supported rendered poses with less than 0.1 mm surface separation, no wire/bead/base penetration, preserved counts/weave/spacing, and photography only after corrected poses apply. The unobstructed original block must reach its own wire; an earlier base or neighboring contact must not be crossed to force that result.

#### ISS-5.13 — Plywood normal guide included relief omitted by the tracer

- **Severity:** MEDIUM
- **Location:** `bead-materials.js`, `photo-guides.js`, pinned tracer material encoder.
- **Tool Evidence:** The actual pinned encoder returned identical material arrays with a bump map and with it removed; its normal-map slot stayed -1. The plywood supplied that bump map while the raster guide included it. A normal map encoded correctly in slot 16. Jev supported this source/probe compatibility finding at 0.94.
- **Persona Critique:** The traced surface and denoising guide must describe the same relief.
- **Acceptance Criterion:** A supported tangent normal map shared by the viewer, tracer and guide; no bump-only plywood relief; material-encoding and guided export checks. Photographic equivalence is separate.

#### ISS-5.14 — Raster and tracer derived different paint tangent frames

- **Severity:** MEDIUM
- **Location:** Normal-mapped geometry from `bead-geometry.js`.
- **Tool Evidence:** Returned meshes had no tangent attribute. r160 used its derivative frame, whereas the tracer generated vertex tangents. A CPU probe applying both source formulas to actual painted triangles/map samples found area-weighted mean differences up to 0.385° and maxima up to 4.802°. This measures the formulas, not an independent pixel-level AOV comparison.
- **Persona Critique:** Paint detail should retain a shared authored basis across the interactive, traced and guide surfaces.
- **Acceptance Criterion:** Finite orthonormal shared tangents on final bead/board UVs, preserved by actual tracer preparation; unchanged physical geometry and draw groups; fresh guided captures.

#### ISS-5.15 — One coarse plywood veneer repeated across the entire edge

- **Severity:** MEDIUM
- **Location:** `bead-materials.js`, board UV chart.
- **Tool Evidence:** The 128×64 tile repeated every 3.25 mm. A 29 mm specimen rendered about nine broad identical stripes. Fixed-camera 256-sample/OIDN comparisons of that baseline, a 21-layer hybrid, and a richer hybrid showed reduced stripe dominance but incomplete cut-grain detail. The generated 30-file low view was screened too. Manufacturer references motivate a thin-veneer stack; they do not establish an exact 32 mm catalog product.
- **Persona Critique:** Decorative stripes do not supply distinct veneer detail, and a full-stack atlas needs a chart that closes around corners.
- **Acceptance Criterion:** Declared full-thickness stack, distinct layers and narrow separate bond masks, continuous perimeter phase, supported independent normals, unchanged physical geometry, fresh rendered close/low inspection and loading/fallback recovery. Full photographic equivalence remains separate.

#### ISS-5.16 — Packed texture sampling crossed the full-stack V boundary

- **Severity:** LOW
- **Location:** Plywood map sampling; pinned `RenderTarget2DArray`.
- **Tool Evidence:** The source requested clamp wrapping, but the tracer's packed array repeats both axes. Opposite color rows differ by up to 18 RGB levels. A real GPU probe comparing clamped-source and packed-array samples at both V boundaries measured a maximum difference of 11 levels, with opaque nonblack samples.
- **Persona Critique:** Filtering must not borrow a veneer from the opposite edge of the panel.
- **Acceptance Criterion:** Shared texel-centre guarded sampling; real packed/source border samples agree within 8-bit quantization, with normal/bake/lifecycle checks retained.

#### ISS-5.17 — Barrel shoulders exposed large polygon corners

- **Severity:** MEDIUM
- **Location:** The barrel meridian in `bead-geometry.js`.
- **Tool Evidence:** Its 13 painted profile points changed direction by up to 33.76°. A fixed-camera, 1600-pixel, 256-sample raw/OIDN specimen showed visible shoulder corners despite smooth normals. Refining the outer meridian reduced the largest turn to 9.27° and rounded the outline; the experimental comparison also doubled radial resolution, so it does not isolate that contribution.
- **Persona Critique:** Smooth shading does not repair a polygonal silhouette at the close viewing distances available in the viewer.
- **Acceptance Criterion:** Round the painted outline within its clearance envelope, retain the original bore/lip dimensions and material boundary, and verify shared UV/tangents, actual contacts and generated photographs.

### Fixes

#### FIX-5.17 → ISS-5.17

- **Location:** `bead-geometry.js`, `test/barrel-contour.test.mjs`.
- **Action Taken:** Apply two convex corner-cut refinements to the barrel's painted meridian only. Keep its 64 radial segments, exact bore/chamfer points, paint boundary and physical coating chart. Other bead forms and paint materials are unchanged. The barrel now has 6,912 triangles rather than 1,920; geometry remains shared by all beads of that kind.
- **Tool Verification:** The geometric regression measures a maximum meridian turn below 10°, checks the radius-27 envelope and exact bore/lip points, and verifies complete draw-group coverage. Focused contour, physical-UV-scale and actual-tracer tangent tests pass. Revision-bound full-suite results and fresh captures are retained in the review ledger.
- **Limits:** This is a local silhouette repair, not a measured reconstruction of a manufactured bead. Earlier byte-identical geometry statements describe their own repairs; this repair intentionally changes barrel vertices and requires seating to use the refined mesh. The initial specimen had a fixed pigment and f/64 camera, distinct from the normal full-scene photographic configuration. ISS-5.01 remains open.

The associated paint experiment evaluated object-space axial fibres at authored 0, 5 and 15 µm coefficients under a common weaker coating field, with raw and guided 256-sample captures. A separate control reduced the existing height field to 20%. Neither established a convincing coated-timber appearance, so neither finish is shipped. No atlas dependency or extra per-shape textures were added for that inconclusive result.

#### FIX-5.16 → ISS-5.16

- **Location:** Plywood color/normal texture transforms and `finish-review.mjs`.
- **Action Taken:** Inset V sampling by half a 1K texel and scale it between the two edge texel centres in both renderers. Keep the full-stack geometry chart and physical board unchanged. The pinned packer restores these texture matrices after copying pixels.
- **Tool Verification:** The actual GPU source-versus-packed test reduced maximum boundary difference from 11 to 1 RGB level across 64 paired sample positions. Alpha was 255 and maximum color 164, rejecting an empty/black probe. This is a narrow edge-sampling check, not a whole-image photographic verdict.

#### FIX-5.15 → ISS-5.15

- **Location:** `plywood-finish.js`, board factory, material/photograph readiness and bake/verification scripts.
- **Action Taken:** Bake an authored 32 mm / 21-ply photo-derived hybrid from the existing CC0 maple source, with distinct layer offsets/tints, separate narrow bond masks and independently authored shallow relief. Map the whole thickness once and close nominal 160 mm repeats around the sampled board perimeter. Keep the original board/support geometry. Await settled texture readiness before allocating a photo renderer; errors/deadlines get valid fallback pixels, and late images retain that settled fallback.
- **Tool Verification:** Three legacy board fixture hashes preserve positions, normals and draw groups; identity indexing and shared tangent tests pass. Actual browser tests exercise delayed textures, cancel/rescan, corrupt inputs, deadlines, late results and real traced samples. Source/output hashes are pinned; two local bakes produced identical PNGs. Finished low/close exports were inspected at 256 samples with guided OIDN.
- **Limits:** Face imagery does not recover end-grain anatomy or adjacent-edge grain parity. The 32 mm fabrication, 0.06 mm visual bonds, color rescaling and micrometre relief are authored, not measured. The first hybrid still looked too uniform; the richer candidate is a partial material improvement. ISS-5.01 remains open. See [construction sources and experiment](plywood-construction-research.md).

#### FIX-5.14 → ISS-5.14

- **Location:** `bead-geometry.js`, `test/finish-tangents.test.mjs`.
- **Action Taken:** Compute tangents after final UV mapping, retaining them for raster and tracer use. Re-orthogonalize against the shading direction because r160 lathe join normals need not have unit length. Keep original position/normal buffers, UV handedness and draw groups. Add an identity index to nonindexed board geometry.
- **Tool Verification:** The actual pinned tracer geometry generator preserves the authored basis through rotation and metre scaling. Tests check finite unit tangents, normal orthogonality and handedness for all five bead forms and a beveled board. Independent existing geometry checks retain unchanged physical bead buffers.
- **Limit:** Shared authored tangents remove the derivative-versus-computed basis difference. Raster interpolation, multisampling and finite-aperture guide approximation still differ from accumulated traced AOVs; no exact pixel-normal equivalence is claimed.

#### FIX-5.13 → ISS-5.13

- **Location:** `bead-materials.js`, `finish-normals.js`, `paint-finish.js` and the geometry repeat constant.
- **Action Taken:** Replace plywood's unsupported bump with a tangent normal map from an independently authored shallow relief field, accounting for different horizontal/vertical texel pitches. Replace paint's fine random height/roughness coupling with a smooth periodic millimetre-height field and independent roughness. Keep the 32 mm repeat shared with the geometry. No geometry or support pose changes.
- **Tool Verification:** The real browser factory and pinned encoder carry both normal maps, unit normal scales and no bump-only maps. Independent numerical tests decode paint normals against physical height slopes, including periodic boundaries. The production 256-sample/OIDN close export completed without browser errors and retained visible paint detail.
- **Limits:** Paint height RMS is an authored 18.50 μm, not a measured scan. At this repair the plywood albedo still repeated a single layer, subsequently replaced under ISS-5.15. More visible texture is not proof of photographic equivalence; the close image remains synthetic under ISS-5.01. See [the material research](plywood-fidelity-research.md).

#### FIX-5.12 → ISS-5.12

- **Location:** `bead-contact.js`, `bead-seating.js`, the contact worker/controller, shared support geometry and scene integration.
- **Action Taken:** Use BVH-assisted continuous triangle SAT to find first contact along gravity projected perpendicular to each authored tangent. Stop 0.03 mm before that contact, then independently verify a surface witness below 0.08 mm; an early grazing result uses conservative true-distance refinement. Include wires, the base and neighboring beads. Keep fractions and quaternions fixed. Apply final centers to the rendered graph, labels, selection halo and reference endpoints together.
- **Tool Verification:** Independent reconstructed geometry checks cover 30/240/600 files and 2,000 files with 2/3/19 groups: all contacts measured below 0.1 mm, no wire/bead/base intersections, original block contact restored and center spacing retained. Browser checks cover actual mesh transforms, photograph readiness, worker termination, responsive selection, rescan cancellation, late messages and malformed/failing results. The existing studio lifecycle/export suite passes with these poses.
- **Resources:** A dedicated local worker owns its geometry/BVHs and is terminated after completion, error, cancellation or a 180 s deadline. Only numeric geometry crosses the boundary. Local solve observations were approximately 0.44 s for 30 beads, 8.9 s for 600 and 28 s for 2,000; browser startup to the supported 30-bead map was about 0.8–1.5 s. These are different measurements on one machine, not cross-device benchmarks.
- **Limits:** This is constrained geometric authoring. Axial sliding, tipping, friction, elasticity and complete force/moment balance are not simulated. Zero-area redundant seam triangles are ignored; this solver is not offered for arbitrary degenerate geometry or non-rigid transforms. Photographic equivalence remains open under ISS-5.01.


#### FIX-5.11 → ISS-5.11

- **Location:** Bead geometry UVs, finish texture and regression.
- **Action Taken:** Set a nominal 32 mm coating repeat; map lathe meridians by surface distance and choose whole circumference repeats at the widest ring. Retain the block's chart/bevel layout with a matching scale. Make the faint fibre carrier periodic in both texture axes. Bore timber uses the resulting shared UV chart too; no calibrated wood-grain claim is made.
- **Tool Verification:** Painted-area weighted median repeat scales are now 28.79–32.41 mm across all five forms, with integer azimuth seams. Positions, normals, triangle indices and material groups are byte-identical to the prior meshes. A fixed-camera 256-sample/OIDN close capture has finer relief; both before and after still read as synthetic. The full photographic requirement remains open.


#### FIX-5.10 → ISS-5.10

- **Location:** `docs/photo-stage.js`, photographic renderer and regression suite.
- **Action Taken:** Replaced the flat plane with a broad flat contact surface, smooth curved sweep and surrounding wall. All azimuths use the same actual geometry. Extended the auxiliary camera's far plane so the guide buffers reach the sweep. Kept the flat center to two triangles for BVH traversal and retained the existing owned geometry/material disposal.
- **Tool Verification:** Geometric rays cross the horizon continuously in every azimuth; the photographic suite measures the rendered low-view background and compares guide normals to independent camera-ray intersections. The initial converged sweep reduced the largest background row step to approximately 1.0; its regression limit is 6. These are bounded engineering checks, not a photographic equivalence verdict.
- **Limit:** The sweep changes indirect illumination and has a darker distant background. The first measured full-size hero took 76.4 s on the local machine, compared with roughly 29–32 s before the sweep. Cross-device cost and full photographic equivalence remain unverified.

#### FIX-5.09 → ISS-5.09

- **Location:** Asset builder and vendor notices.
- **Action Taken:** Added the unmodified upstream Float16 MIT license and locked dependency provenance.
- **Tool Verification:** Asset rebuilding and static license serving checks cover the added notice.

#### FIX-5.06 → ISS-5.06

- **Location:** `docs/finish-normals.js`, `docs/bead-materials.js`, `test/finish-normals.test.mjs`.
- **Action Taken:** Corrected the row-to-UV derivative and factored height-to-normal conversion for an independent analytic regression. Retuned gloss/paint relief against the real toy reference; reduced the block's over-rounded silhouette.
- **Tool Verification:** Analytic sine-height derivatives agree with decoded normals across both axes and wrap boundaries; existing bore/winding/envelope checks pass.

#### FIX-5.07 → ISS-5.07

- **Location:** `docs/photo-denoising.js`, `docs/photo-guides.js`, photographic renderer, asset builder and validation.
- **Action Taken:** Added local guided OIDN with linear HDR/albedo and encoded shading normals, 1600-pixel exports, full convergence captures, revision cancellation and owned-device disposal.
- **Tool Verification:** Real FP16 WGSL inference completes at 256 samples in overview/close/mobile; linear albedo and normal convention probes pass. PNG exports, missing-model fallback and cancellation during initialization/inference pass. The network has zero active jobs after completion and zero tracked buffers after disposal. No external HTTP is used.

#### FIX-5.08 → ISS-5.08

- **Location:** `docs/bead-layout.js`, `test/bead-threading.test.mjs`.
- **Action Taken:** Reject placement candidates on bends exceeding the bore's radial margin, using precomputed arc lengths. The geometry and node counts are retained.
- **Tool Verification:** Actual shell/tube BVH intersections fail before the fix at 240/600 files and pass after it at 30/240/600. Other spacing and weave tests pass.

#### FIX-5.05 → ISS-5.05

- **Location:** `docs/bead-photograph.js`, `scripts/studio-review.mjs`.
- **Action Taken:** Bound context-loss handling to the owning generation; added the close/reopen/stale-event regression to the real browser suite.
- **Tool Verification:** The original focused probe and the full studio suite pass after the guard.

#### FIX-5.02 → ISS-5.02

- **Location:** This report and README.
- **Action Taken:** Corrected the current entry point, labeled historical capture results, removed the unsupported generated equivalence implication.
- **Tool Verification:** Current entry point and photo source inspected; limitations explicitly retained. The original photographic requirement stays open.

#### FIX-5.03 → ISS-5.03

- **Location:** `docs/bead-photograph.js`, `docs/bead-materials.js`, `scripts/vendor-3d.mjs`, `scripts/studio-review.mjs`.
- **Action Taken:** Added actual-geometry progressive tracing, explicit single-material submeshes, equirectangular lighting, area softboxes, white-maple response, paint normals, edge-aware denoising and PNG export. Isolated the GPU lifetime; use single-layer enamel on Apple/private GPUs because the upstream coat defect persists. Preserve layered materials elsewhere, without claiming another-GPU verification.
- **Tool Verification:** 256-sample capture: 6,761 red, 7,127 blue and 6,064 green pixels, zero near-black pixels out of 611,830. Real download, orbit resets, repeat contexts, cancellation, resize, selection/rescan/context cleanup, 600 files and missing-bundle recovery pass. One local 600-file run reached four samples in 6.57 seconds; this includes preparation and is not a cross-device benchmark.

#### FIX-5.04 → ISS-5.04

- **Location:** `scripts/render-bead-maze.py`, `scripts/check-offline-beads.py`.
- **Action Taken:** Enlarged the drill to 6.5 mm radius, modeled a distinct beveled cylinder and assigned bare timber to bore walls.
- **Tool Verification:** Blender rays pass through all six bead kinds; every kind has both paint and timber. Worst authored radial scale plus resting offset leaves 0.59–1.23 mm radial clearance. This check does not establish clearance along every curved rail. Historical stills below predate this correction.

### Continuation

ISS-5.01 is open. A fresh unchanged clean pass and `review.py gate` have not been reached. Continue with close-view manufacturing/material detail and multi-angle photographic comparison, retaining the full original goal. The existing unit, browser interaction, accessibility and fidelity checks pass; the progressive renderer has its own image/lifecycle suite. These are engineering checks, not an equivalence certificate.

## Verdict

The earlier experiment displayed real product photographs in `docs/bead-maze-photo3d.html`. Its recorded similarity measurements compare resampled photographic pixels against their own sources. They measure resampling fidelity, **not** the realism of generated geometry. The historical model scores below have not been independently reproduced in this review.

**The earlier procedural models remained stylized.** The separate Cycles still below uses a six-lobed base and 18 beads; it is not a rendering of a scanned repository. The photographic companion remains available through the real-toy link; the default page opens the generated graph.

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
