# Code Maze guide

[← Back to the visual introduction](../../README.md)

Generate a bead maze from a local repository. Each bead is a file. Continuous painted tracks hold the files in each directory, including files with no references. Selecting a bead reveals directional reference arrows.

## Run locally

Use Node.js 22 or newer.

```sh
npm install
npm start
```

Open <http://localhost:3000>. Enter a local repository path and click **Generate map**. The initial map scans this project. To start with another repository:

```sh
npm start -- /absolute/path/to/repository
```

Drag to orbit, scroll to zoom, and hover over a bead for its full path. Focus the maze and use arrow keys to orbit, plus and minus to zoom, or zero to reset. Select a bead to inspect its file. Use **File names** to toggle labels and **Reset view** to frame the entire toy again. You can also filter the file list and select files with the keyboard. Selecting a file adds a gold halo and a full-path label. Dashed gold arrows show outgoing references, and blue arrows show incoming references. Solid directory tracks are physical supports, not dependency edges.

Choose **Show me how** for a three-step discovery through a real file reference. The guide explains the same connection from both ends, with instructions beside the maze on small screens. The **Motion** button turns the playground effects on or off and remembers your choice. Device reduced-motion settings take priority. Anime.js 4 animates entrances, beads, and reference lights; canvas-confetti celebrates completing the discovery. Both ship locally with the static viewer. [Library versions and licenses](../vendor/playground-libraries.md) are recorded with the assets.

The maze mixes tall upright loops, compact corkscrews, and low winding paths around a shared core. Differently angled loops surround corkscrew coils, and winding tracks cross beneath both. Placement requires the corkscrews to pass through loop openings while preserving clearance for beads and wires. Large directories are split across tracks with at most 18 files each. Larger maps use neighboring sections of up to 12 mixed tracks on the same wooden base. Beads stay threaded along their tracks, and crossings stay separate in depth.

The toy uses five drilled bead shapes, including a rounded block baked with BVH CSG. Bare timber lines the holes; satin paint, veneer grain, layered plywood edges, and studio reflections give the maze depth as you orbit. N8AO adds contact shading, using its neural denoiser on wide stages and a lighter preset on narrow ones. All assets ship locally. [Tool research](../maze-3d-tools-research.md) and [pinned tools, licenses, and asset rebuilding](../vendor/fidelity-libraries.md) explain the combination.

Compare the same fixture and camera: [before](../maze-fidelity/before.jpg) · [after](../maze-fidelity/after.jpg).

Beads receive geometry-checked support poses before a photograph is enabled; the map remains interactive while the toy finishes. These are authored contact poses, not a simulation of sliding beads.

Choose **Studio photo** to photograph your generated maze with progressive path tracing, soft studio lights and indirect color bounce. Drag or zoom to choose an angle; the interactive map appears while the new view refines. **Save photo** downloads the current image as a PNG, up to 1600 pixels on its long side. After 256 samples, supported WebGPU devices refine the light buffer with Open Image Denoise, guided by the same model's albedo and surface normals. The model ships locally; unsupported devices retain spatial denoising. Selection or a new scan releases the photo's GPU resources, and hidden tabs pause refinement. Apple GPUs use a single-layer enamel finish to avoid an upstream black-clearcoat defect. Photographic indistinguishability remains unverified. [Converged close-up](../maze-fidelity/studio-close.png).

The server binds to `127.0.0.1`. Scanning reads files locally and does not execute repository code or send source to a service. Only map metadata is returned to the browser; source text stays out of the graph.

## Save and export a map

Generate a JSON snapshot from the command line:

```sh
npm run scan -- /absolute/path/to/repository
```

This writes `docs/repository-map.json`. You can choose an output path or increase the file limit:

```sh
npm run scan -- /absolute/path/to/repository --output /tmp/my-map.json --max-files 1000
```

Build a static viewer for the saved snapshot:

```sh
npm run build
npm run preview
```

Open <http://localhost:3000>. Stop any running development server first, or use `npm run preview -- --port 3001`.

The build uses `docs/repository-map.json` when it exists; otherwise it scans this project. Deploy the contents of `dist/` to a static host. The exported viewer loads its graph, Three.js library, and textures locally. Its path input is disabled because scanning another local folder requires the development server. Browser scans do not overwrite the CLI snapshot.

## What the scanner maps

The scanner includes recognized source, documentation, and configuration files. It groups files by their first directory component and keeps unconnected files visible.

Relationship extraction supports:

- JavaScript and TypeScript imports, re-exports, literal `require()` calls, and literal dynamic imports, including JSX and TSX. These use the TypeScript parser and module resolver. Direct `tsconfig.json` or `jsconfig.json` path aliases are supported; inherited compiler settings are not expanded.
- HTML script and link references, inline JavaScript imports, and CSS-family imports.
- Common Python import statements, quoted C/C++ includes, and Rust external `mod name;` declarations, using static text patterns.

Dependencies outside the scanned file set are not drawn. Computed imports, runtime relationships, Python custom import paths, C/C++ build include paths, and Rust `use` resolution are not inferred. Files in other recognized languages still appear as beads without inferred relationships.

Nested `.gitignore` rules are honored. Hidden paths except `.github`, dependency and build directories, symlinks, binary files, and generated map files are skipped. The default limits are 600 files, 512 KiB per file, 24 MiB of content, and 50,000 visited entries. The CLI file limit can be raised to 2,000. Omitted files, traversal limits, and read or parse failures appear in scan notes. An incomplete scan does not imply a complete dependency graph.

## Develop and verify

```sh
npm test
npm run build
npm run smoke
npm run test:ui
npm run test:fidelity
npm run test:studio
npm run test:photographic
npm run test:contact -- --large
npm run test:contact-ui
```

The tests cover module resolution, nested ignore rules, non-JavaScript references, cycles, limits, missing paths, and API behavior. Layout tests check that every bead is threaded onto an anchored track and that beads have physical clearance. Actual bead/tube mesh intersections check each bead's own curved wire at 30, 240 and 600 files. Independent checks derived from the generated vertices verify that corkscrews thread tall-loop openings and low winding paths pass beneath both other track types.

The browser smoke check uses installed Google Chrome. It covers generated WebGL rendering, direct bead hover and picking, selection labels, label toggling, reset, search, failed scans, rescanning, mobile canvas fallback, and the static export. Screenshots go to `.scratch/verification/`. To use Playwright's Chromium instead, run `npx playwright install chromium` and then `BROWSER_CHANNEL=chromium npm run smoke`.

The UI review also uses Chrome (or `BROWSER_CHANNEL=chromium`). It exercises the guided discovery, keyboard navigation, empty searches, responsive layouts, live reduced-motion preferences, empty and disconnected maps, self-references, and missing effect libraries. Axe checks WCAG A/AA rules in desktop, selected, mobile-tour, and fallback states.

The fidelity review captures fixed-camera hero, close, low, selected and mobile views, checks shader errors and responsive denoiser switching, verifies stable GPU resource counts after rescans, exercises a 600-file map, and checks interaction with unavailable studio tools/textures. Screenshots and frame measurements go to `.scratch/verification/fidelity/`. Frame measurements describe the local test machine, not a cross-device performance guarantee. Geometry tests independently raycast every bore and check shell winding and layout clearance. Rebuild the pinned modeling/rendering assets with `npm run assets:3d` after installing development dependencies.

The active implementation lives in:

- `lib/scan-repository.mjs`: file discovery and graph generation.
- `scripts/server.mjs`: local scan API and app server.
- `scripts/scan.mjs`: CLI snapshot generation.
- `docs/codebase-map.js`: scan controls, file search, and selection.
- `docs/bead-layout.js`: continuous directory tracks, bead spacing, positions, and tangents.
- `docs/bead-scene.js`: Three.js rendering, camera fitting, labels, picking, and reference highlights.
- `docs/bead-geometry.js`, `bead-materials.js`, `bead-rendering.js`: drilled bead models, timber and paint materials, and the optional studio/N8AO pipeline.
- `docs/bead-photograph.js`, `photo-guides.js`, `photo-denoising.js`: progressive PNG rendering, linear feature buffers, and cancellable WebGPU refinement.
- `docs/bead-fallback.js`: canvas fallback using the same graph.
- `docs/discovery-guide.js`: the three-step reference discovery and mobile instructions.
- `docs/playground-motion.js`: optional effects and motion preferences.
- `docs/playground.css`: responsive playground presentation.

## Original bead maze material

The implementation and assets were copied on 2026-11-01 from `/Users/nicolas/Documents/github/prompt-pack`. The latest source commit affecting the original viewer was `23b29eb`.

The import included 208 files: all file paths containing bead or maze, content that mentions the bead maze, vendor dependencies, and the source license. It included hidden and ignored files outside Git internals, installed dependencies, Python caches, and `.DS_Store` files. `import-manifest.json` records their checksums at import time. Active viewer files have since changed to support generated maps.

The original generated pages remain in `_site/docs/` for reference. The photographic companion remains at `/docs/bead-maze-photo3d.html`. Reference photos, video clips, source metadata, and captures remain in `docs/bead-maze/`. The copied handbook and fidelity report describe the original project; their measurements have not been repeated for this viewer.

The copied `scripts/build-pages.mjs` expects the rest of `prompt-pack` and is preserved for reference. Use this project's `npm run build` instead. The optional `scripts/*bead*.py` asset generators require their original Python libraries or Blender, as described in the handbook.

`LICENSE` preserves the original MIT notice. Third-party libraries and reference media retain their respective terms and source metadata.
