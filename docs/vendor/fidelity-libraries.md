# Maze modeling and rendering tools

Discovery and primary-source compatibility evidence are in [the research note](../maze-3d-tools-research.md). These browser assets run locally and are included in the static export.

| Tool | Pinned version | Use | License copy |
| --- | --- | --- | --- |
| [N8AO](https://github.com/N8python/n8ao) | 2.0.1 | Contact occlusion, neural denoising on wide stages, Poisson denoising on narrow stages | n8ao.LICENSE (CC0 1.0; upstream package metadata says ISC) |
| [postprocessing](https://github.com/pmndrs/postprocessing) | 6.35.3 | HDR composer, MSAA, final ACES tone mapping and FXAA | postprocessing.LICENSE (Zlib) |
| [three-bvh-csg](https://github.com/gkjohnson/three-bvh-csg) | 0.0.16 | Authoring-time subtraction of a through-hole from a rounded block | three-bvh-csg.LICENSE (MIT) |
| [three-mesh-bvh](https://github.com/gkjohnson/three-mesh-bvh) | 0.8.3 | CSG acceleration during baking | three-mesh-bvh.LICENSE (MIT) |
| [three-gpu-pathtracer](https://github.com/gkjohnson/three-gpu-pathtracer/tree/v0.0.23) | 0.0.23 | Progressive multi-bounce studio photographs of the generated mesh | three-gpu-pathtracer.LICENSE (MIT) |
| [glslSmartDeNoise](https://github.com/BrutPitt/glslSmartDeNoise) | Shader shipped inside pathtracer 0.0.23 | Edge-preserving final denoising | glslSmartDeNoise.LICENSE (BSD-2-Clause) |
| [Three.js](https://github.com/mrdoob/three.js/tree/r160) | 0.160.0 | Existing shared engine, RoundedBoxGeometry and RoomEnvironment | three.LICENSE (MIT) |

Versions and the build tool are pinned in package.json/package-lock.json. Rebuild with Node 22+:

```sh
npm ci
npm run assets:3d
```

`scripts/bake-bead.mjs` writes `bead-block.js`: engine-independent vertex data and two material groups, painted exterior and bare bore. It uses CSG once during authoring; the browser never performs Booleans. Other beads are analytic lathe surfaces built once per viewer, with outward winding and true bore walls.

`scripts/vendor-3d.mjs` writes `fidelity.js` with esbuild. Three is externalized to `./three.module.js`, including imports inside third-party tools. This avoids loading a second engine. The script checks the installed and browser revisions match, and copies upstream licenses. Core Three is the existing local r160 asset; it is not replaced by this command. The generated bundle includes upstream source, including N8AO's neural denoiser, with no runtime model downloads.

The render order is RenderPass → N8AOPostPass → ACES/FXAA. Linear half-float buffers preserve highlight range; N8AO's gamma conversion is disabled, and the final effect supplies the sole tone mapping/color conversion. MSAA preserves thin wire geometry before postprocessing. Accumulation stays disabled: the viewer renders on demand. Resize changes quality at 700 CSS pixels of stage width. WebGL1, missing float render-target support, or unavailable effects retain direct WebGL; unavailable Three retains the existing canvas fallback.

The camera frustum scales with the fitted toy to preserve depth precision. AO uses a 20-unit radius and a 0.8-unit bias to avoid false self-occlusion on smooth enamel. Faded multi-material beads explicitly enter the transparent overlay path. Runtime compositor failure releases its render targets and N8AO's custom fullscreen resources before returning to direct rendering; the fidelity check injects that failure and observes disposal.

The interactive studio environment is generated once from Three's RoomEnvironment and filtered with PMREM. It supplies shaped reflections without a network dependency. The existing white-maple diffuse/normal/roughness and fine-grained timber assets are reused; their historical import and media records remain in import-manifest.json and the handbook. Paint has a seeded tangent-space normal map so the same finish works in both renderers. No new external textures were downloaded.

## Progressive photographs

`pathtracer.js` is a separate lazy bundle with the same external Three core. The compatibility adapter supplies the scene rotation fields absent from r160, including the internal empty scene created by the upstream constructor. The photographer splits each multi-material bead into its existing indexed material groups: the pinned scene merger otherwise assigns one material per mesh and shifts subsequent IDs. Geometry and transforms come from the active generated graph, not the historical fixed toy or its photographs.

The photo scene converts layout millimetres to metres, uses three rectangular softboxes and a low-energy procedural equirectangular environment, and replaces the raster shadow catcher with a diffuse studio floor. It never feeds the PMREM CubeUV texture to the equirectangular sampler. A physical camera uses f/16; SmartDeNoise uses a small edge-aware kernel before the single final ACES/sRGB conversion. The PNG download contains the generated scene without labels, selection transparency, or dependency arrows.

Apple/Metal GPUs exhibit upstream [black clearcoat issue #711](https://github.com/gkjohnson/three-gpu-pathtracer/issues/711). They use a single dielectric paint layer with adjusted roughness; unidentified GPUs use that same fallback. Identified non-Apple GPUs retain the layered material. Local shader experiments with grazing guards, removing nested `inout` mutation, and disabling importance sampling did not resolve the defect, so those unsuccessful shader edits are not shipped. The full layered path has not been verified on another GPU.

The renderer owns an isolated WebGL context, capped at 1600 pixels on its longest side and DPR 2. It stops after 256 samples and pauses in a hidden tab. Orbit debounces tracing while the map remains interactive. Selection, rescan, cancellation, and context failure destroy the photo context, releasing all its GPU allocations without disposing the map's shared textures or geometry. This also avoids upstream's broken `WebGLPathTracer.dispose()`; r160 shader compilation is polled with cancellation/context-loss handling and a 30-second deadline. Missing tools retain the working map. No runtime network downloads are used.

`npm run test:studio` verifies lit RGB paint (catching the black-material regression), PNG export, sample reset on orbit, selection/rescan cleanup, actual context loss, cancellation, mobile resizing, a 600-node photograph, and unavailable-bundle recovery. Screenshots are in `.scratch/verification/studio/`. These tests verify rendering and lifecycle; they do not certify photographic equivalence. The denoiser's accompanying BSD license is from upstream `license.txt`, Git blob `6ce8dacef27906c1c0f9b726af1b28f5065c86c2`.
