# Bead Maze Reference Corpus

A measured corpus of real bead-maze products, assembled to drive the digital twin in
`docs/codebase-bead-maze.html`. Every downloaded asset keeps its source URL in
`photos-manifest.json`; this file records what the corpus shows and which rules the
renderer must satisfy.

## What was collected

| Asset class                   | Count    | Location                              |
| ----------------------------- | -------- | ------------------------------------- |
| Real product/lifestyle photos | 100      | `docs/bead-maze/photos/`              |
| Contact sheets (5×4)          | 5        | `docs/bead-maze/contact-sheets/`      |
| Video clips + metadata        | 3        | `docs/bead-maze/videos/`              |
| Photo source manifest         | 100 rows | `docs/bead-maze/photos-manifest.json` |

Search queries used (Firecrawl image search, 2026-10-22): "wooden bead maze toy wire
beads", "Anatex rollercoaster bead maze wooden toy", "Educo supermaze bead maze wooden
wires", "Melissa Doug classic bead maze product photo", "Hape original super bead
maze", "bead maze wooden toy isolated white background", "vintage bead roller coaster
wooden toy", "bead maze toddler toy close up beads", "bead maze wooden base colorful
wires beads", "montessori wire bead maze toy".

Video IDs: `-9SxoA5G4mY`, `BSth-6oKZlo`, `lMg_Sw-hD24` (see the adjacent
`.info.json` for title, channel, duration, and source URL).

## Aggregate design rules measured from the corpus

### Base

- Two dominant constructions:
  1. **Dual-runner / ladder base** — two parallel wooden rails joined by cylindrical
     cross-dowels; the dowels often double as a short abacus track. This is the
     majority pattern in the corpus.
  2. **Solid chamfered slab** — one solid block with rounded edges and flush wire
     anchors. The Melissa & Doug Classic and the Wikipedia reference use this.
- Wood is light blonde hardwood (beech, rubberwood, birch) or warm honey-lacquered
  pine. Finish is satin, not high gloss.
- Every exposed edge is rounded or chamfered; sharp 90° corners do not appear.
- Wire insertion points are visible: drilled holes with black plastic/rubber collars
  or flush wooden collars.

### Wires

- Diameter is roughly 3–5 mm on a 300 mm base, i.e. **1–1.7% of base width**.
- Coating is powder coat or enamel over rigid steel; finish is semi-gloss to gloss.
- Each wire is a single color for its whole run. Classic palette: red, blue, yellow,
  green, orange.
- Topology typically combines a tall loop/arch, a corkscrew or conical spiral, and a
  low serpentine run. Wires interlock in 3D but never touch.
- Both ends terminate at the base or at a closed loop; open wire ends are not
  acceptable because beads would fall off.

### Beads

- Shapes: spheres (most common), discs/washers, short cylinders/barrels, cubes,
  faceted forms, and occasional flat character silhouettes.
- Beads are painted opaque, high-contrast colors; alternating color sequences are
  common along one wire.
- Hole clearance is generous: roughly 1.5–2× the wire diameter so beads pass bends.
- Each run carries several beads, not one.

### Proportions

- Base width to maximum wire height is about **1 : 1.0–1.3**. The toy is tall, not a
  flat board with low rails.
- Base thickness is roughly 8–10% of base length.
- Camera: 3/4 view, 20–30° downward tilt; toy fills 65–85% of frame.

### Presentation

- E-commerce photos: seamless white or pale neutral sweep, high-key diffuse studio
  lighting, soft contact shadows, minimal harsh specular highlights.
- Lifestyle photos: warm indoor surfaces, natural window light from one side.

## Rules the renderer must enforce

1. Wire height must reach at least the base width (1:1), not 1:0.25.
2. Every wire endpoint must terminate at the base or close into a loop.
3. Wire diameter ≈ 1.2% of base width; beads ≈ 4–5% of base width.
4. Include at least three bead shapes (sphere, ring/disc, cylinder).
5. Rounded/beveled base edges; visible grommets at anchors.
6. Camera 3/4, 20–30° down, model filling most of the frame.
7. Neutral white/cream background with a soft contact shadow under the base.
8. Semi-gloss wires and satin wood; avoid flat matte clay shading.

## Known gaps in the current digital twin

- Beads are positioned by graph node, not settled by gravity, so some rest high on
  inclines.
- The base is a single slab rather than the corpus's dominant dual-runner form.
- Wire runs are graph edges rather than one continuous bent rod per color.
- No micro-surface noise (wood pores, paint edges, dust) or depth of field.

These are the next levers for photorealism; geometry and composition now match the
corpus's broad shape.
