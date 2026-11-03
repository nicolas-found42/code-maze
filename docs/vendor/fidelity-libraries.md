# Maze modeling and rendering tools

Discovery and primary-source compatibility evidence are in [the research note](../maze-3d-tools-research.md). These browser assets run locally and are included in the static export.

| Tool | Pinned version | Use | License copy |
| --- | --- | --- | --- |
| [N8AO](https://github.com/N8python/n8ao) | 2.0.1 | Contact occlusion, neural denoising on wide stages, Poisson denoising on narrow stages | n8ao.LICENSE (CC0 1.0; upstream package metadata says ISC) |
| [postprocessing](https://github.com/pmndrs/postprocessing) | 6.35.3 | HDR composer, MSAA, final ACES tone mapping and FXAA | postprocessing.LICENSE (Zlib) |
| [three-bvh-csg](https://github.com/gkjohnson/three-bvh-csg) | 0.0.16 | Authoring-time subtraction of a through-hole from a rounded block | three-bvh-csg.LICENSE (MIT) |
| [three-mesh-bvh](https://github.com/gkjohnson/three-mesh-bvh) | 0.8.3 | CSG acceleration during baking | three-mesh-bvh.LICENSE (MIT) |
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

The studio environment is generated once from Three's RoomEnvironment and filtered with PMREM. It supplies shaped reflections without a network dependency. The existing ash diffuse/normal/roughness and fine-grained timber assets are reused; their historical import and media records remain in import-manifest.json and the handbook. No new external textures were downloaded.
