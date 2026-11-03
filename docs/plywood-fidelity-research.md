# Plywood edge and painted timber fidelity research

Investigated 2026-11-03 against the working tree based on `7d8bedd`. This is a research proposal, not a visual-improvement claim. No production material was changed and no new texture pack or authoring application was downloaded. The existing close photograph remains the baseline; photorealism is not established by passing render tests.

## Finding

The narrow primary-source search did **not verify a CC0 photographic plywood-edge PBR set** suitable for redistributing in this public static site. This is a bounded negative result, not a claim that none exists. A material named “plywood” may be a board's broad face; its name does not establish exposed laminated-edge detail.

| Candidate | Verified availability and scale | License and decision |
| --- | --- | --- |
| [Poly Haven Plywood](https://polyhaven.com/a/plywood) | Face material described as continuous linear grain, 0.5 m wide; 1K/2K/4K/8K; diffuse, AO, roughness, displacement and GL/DX normals. Not an exposed layer stack. | CC0. Does not solve edge photography; do not download on its name alone. |
| [Poliigon Plywood Board Edge 8275](https://www.poliigon.com/texture/plywood-board-edge-texture/8275) | Explicit layered veneer trim; 30 × 30 cm, 1K/2K. PNG diffuse, roughness, AO, displacement 16-bit, metalness, normals and normals 16-bit. Premium download. | Commercial licenses, not CC0. The asset page explicitly bars redistribution/repackaging under its individual license and external sharing under its business license. Do not vendor into this public repo without separate applicable permission. Useful as a visual target, not an available source asset. |
| Existing [White Maple Veneer](https://polyhaven.com/a/white_maple_veneer) | Local diffuse/GL normal/roughness are each 1024 × 1024; source width 1 m, available through 8K. Smooth veneer face, not crossgrain. | CC0; already present and appropriate for a no-download hybrid experiment. |
| Existing [Fine Grained Wood](https://polyhaven.com/a/fine_grained_wood) | Local color/GL normal/roughness are each 1024 × 1024; source width 0.6 m, available through 8K. Worn wood face. | CC0; already present. Its worn dirt/scratches may be unsuitable for clean toy enamel. |

Poly Haven's [asset license](https://polyhaven.com/license) permits modification and redistribution of its CC0 assets. Its website text, example renders and other site content have separate restrictions; use the actual downloadable maps. [Texture standards](https://docs.polyhaven.com/en/technical-standards/textures) describe photo-derived sources and measured scale, but they do not make a face map a scan of a cut edge.

## Baseline implementation at 7d8bedd and concrete pitfalls

Repository discovery began with `jg "How are plywood edge textures and physical material scale built and loaded?" /Users/nicolas/Documents/github/code-maze/docs --max-requests 3 --max-output-bytes 15000 --concurrency 4`. It reported incomplete discovery due to request limit and returned reading leads. Direct reads of `bead-materials.js`, `bead-geometry.js` and `vendor/fidelity-libraries.md` supply the observations below; the incomplete result is not evidence of absence elsewhere.

- `bead-materials.js` creates a 128 × 64 single-veneer tile with the same dark seam and sinusoidal grain repeated across every layer. It also uses that colored map as bump. Pigment/dark glue is not measured height: this couples strong color boundaries to invented relief.
- `bead-geometry.js` sets edge V to `y / 3.25` and edge U to `(x + z) / 420`. All layers therefore repeat at exactly 3.25 mm; adjacent edges lack an explicit perimeter-distance chart. A photographic full-stack atlas needs new UV scale, not merely a texture replacement.
- Top face UVs repeat the 1 m maple capture every 420 mm, shrinking its physical features to 42% of source scale. That is an authored choice, not calibrated maple grain.
- Existing paint repeats at a nominal 32 mm, using a 256² procedural fibre/noise height-derived normal. Neither the repeat nor amplitude was measured from painted timber. At 256 pixels per 32 mm the authored sampling is 8 px/mm; that does not prove visible fibres or orange peel have appropriate physical sizes.
- Upscaling a 1K photographic source cannot recover finer fibres. Strips selected from a wood face can add real irregularity but cannot reconstruct the alternating cut grain of real crossed veneers. A hybrid must be labelled accordingly.

## Recommended authoring tool and bounded experiment

[RodZill4/material-maker](https://github.com/RodZill4/material-maker) is an offline node-graph texture author and model painter, with an [MIT software license](https://github.com/RodZill4/material-maker/blob/master/LICENSE.md). It is justified here as an **authoring tool**, not a runtime dependency. The [Image node](https://rodzill4.github.io/material-maker/doc/node_simple_image.html) imports existing maps and preserves non-square aspect ratio; [material export definitions](https://rodzill4.github.io/material-maker/doc/material_nodes.html) emit PNG/EXR texture files. Its software license is not a blanket license for community materials or imported photographs.

The most useful next experiment is a baked full-thickness edge atlas, retaining the current renderer, geometry and lighting:

1. Build a 2048² prototype atlas from independently offset strips of the local CC0 maple/fine-grained imagery, with separately authored veneer boundaries, per-layer tint, mild width drift and sparse tiny defects. Keep layer count/thickness explicit in millimetres and match an actual intended plywood construction; do not randomly imply a particular real product.
2. Keep albedo, height and roughness independent. Use photographic variation for albedo, a separate restrained height field for glue lines/fibre pores, and mostly uniform sanded roughness with modest spatial change. Do not derive relief directly from all dark photographic pigment. Select edge strip physical width and full-stack height before computing UVs.
3. Bake diffuse, roughness and OpenGL tangent-space normals. For paint, compare the existing procedural map against a separate low-amplitude existing-wood normal, preserving solid paint albedo. Do not apply raw wood color to opaque enamel or carry dirty weathered roughness into a clean toy finish. Exporting alone is not proof of correct scale.
4. Produce fixed-camera close and grazing-light A/B exports against the baseline, first at equal sample count without denoising, then at normal denoised settings. Inspect excessive relief, repeated layer signatures, seam continuity at corners, silhouette plausibility and whether denoising erases the change. Promote only after a visible improvement; keep an unsuccessful atlas out of production.

[Normal Map node documentation](https://rodzill4.github.io/material-maker/doc/node_filter_normal_map.html) is particularly relevant: Material Maker's internal normal encoding is deliberately different from OpenGL/DX. Direct export must use its conversion node; normal input connected to a Material node should stay in its expected internal format. Avoid double conversion, gamma-tagged normal/roughness data, and inconsistent UV transforms between channels. The current Three loader uses sRGB only for color maps; preserve that distinction.

If the hybrid still reads as stripes, the next source improvement should be a newly captured, rights-cleared real plywood edge with a ruler and controlled diffuse/cross-polarized lighting, plus grazing/specular references. Record full stack thickness, veneer count, camera orientation and capture dimensions. Such a capture would address the missing information; another procedural package or a higher-resolution face map would not. Do not describe the proposed hybrid as photographic edge PBR.

## Subsequent implementation experiment

The generated paint now uses a separate, smooth periodic height field with authored 0.5–2 mm features and an independent roughness field. Its physical height RMS is 0.01850 mm; decoded normal slope RMS is 0.05015. The 32 mm UV repeat is shared between material authoring and geometry. A stronger prototype remained visible after guided denoising but looked excessively crinkled, so production heights were reduced by one third. These are authored parameters, not measurements of the reference toy.

The plywood's colored bump map also exposed a concrete compatibility defect: the pinned tracer's material encoder ignores `bumpMap`, while the raster normal guide copied it. Plywood now uses a supported tangent normal map generated from a separate shallow relief field, with the different horizontal and vertical physical texel pitches. Albedo remains the existing procedural single-layer tile; it is still visibly repetitive and is not a scanned edge. This fixes shared surface representation without claiming the full-stack atlas proposal above has been implemented.

The bead and board geometry now author tangents after final UV mapping too, sharing the basis with raster rendering and traced geometry. A probe found a small but concrete difference between r160's previous derivative frame and the tracer's computed frame. This does not remove the documented raster/finite-aperture AOV approximation or establish photographic fidelity.
