# Bead contact authoring research

Research date: 2026-11-03. Scope: deterministic static authoring poses for the current bead maze, preserving the chosen rail fractions, bead ordering, and track weave. This note recommends an approach; it does not certify an implementation or photographic equivalence.

## Recommendation

Add a geometry-aware seating pass after the pure layout. Keep layout's coarse slot rejection as a broad phase. Supply the pass with the actual shared bead geometries, actual rail TubeGeometry meshes, and each bead's rendering quaternion. Return corrected centers in the same graph coordinates used for rendering, labels, selection, and edge endpoints. Do not apply an invisible renderer-only offset while leaving graph coordinates unchanged.

For a fixed unit tangent **t**, project world gravity **g** = (0, −1, 0) into the perpendicular plane:

`v = g − t * dot(g, t); d = v / length(v)`.

Translate a valid bead center along **d**, keeping its orientation and rail fraction fixed, until the actual bead/support triangle distance is approximately 0.03–0.08 mm. The proposed tolerance is an authoring choice, not a manufacturing specification. For a nearly vertical tangent the projection becomes ill-conditioned; use an explicit deterministic policy, such as retaining the valid pose and recording that no gravity direction was resolved. Never normalize a numerically zero vector.

## Why nominal radius subtraction is inadequate

The inspected local sources use a nominal 7 mm bore and 4.8 mm support radius, but the bead profiles include lips and variable radii. The ring has a curved inner profile. A common fixed offset of 2.2 mm ignores these surfaces, curve curvature, orientation, and mesh faceting. See [bead geometry](./bead-geometry.js), [layout](./bead-layout.js), and [scene construction](./bead-scene.js).

Three r160 TubeGeometry samples the curve with `getPointAt`, uses computed Frenet frames to place radial vertices, and joins successive rings with indexed triangles. Thus contact must be tested against that discretized surface, rather than an ideal circular cylinder. With 16 radial segments at radius 4.8 mm, the straight-section facet sagitta is `4.8 * (1 − cos(π/16)) ≈ 0.0922 mm` (derived here), already close to a 0.1 mm acceptance threshold. Curvature and axial segmentation introduce additional differences. [Pinned Three r160 source](https://github.com/mrdoob/three.js/blob/r160/src/geometries/TubeGeometry.js)

The layout's polyline point and tangent need not exactly match the rendered Catmull–Rom curve. Verify the starting pose against rendered geometry before seating. A pass that starts with penetration cannot repair it merely by measuring an unsigned distance.

## Minimal robust search

Build BVHs once for each distinct bead geometry and each static rail. Reuse them while changing only rigid transforms; avoid regenerating meshes inside the search. If the rail BVH is the query owner, transform the bead geometry with `inverse(rail.matrixWorld) * bead.matrixWorld`. Use rigid transforms and common millimetre units to avoid scale-dependent distances.

In three-mesh-bvh 0.8.3, `closestPointToGeometry` returns triangle-surface distance and can use the other geometry's BVH. Its `minThreshold` is an early-return threshold; use zero when the actual minimum is required for conservative advancement. `maxThreshold` prunes farther candidates, and a null result means no candidate within the threshold, not zero separation. The witness points use their respective geometry frames. [Pinned API](https://github.com/gkjohnson/three-mesh-bvh/blob/v0.8.3/README.md#closestpointtogeometry), [pinned implementation](https://github.com/gkjohnson/three-mesh-bvh/blob/v0.8.3/src/core/cast/closestPointToGeometry.template.js)

Use conservative advancement rather than assuming distance is monotone or trusting one collision bracket:

1. Establish a valid, nonintersecting initial pose. Evaluate its true minimum surface distance `D`.
2. Stop when own-support distance lies in the selected acceptance interval. Otherwise translate by at most `0.8 * (D − targetGap)` along **d**, where `targetGap` is smaller than the acceptance upper bound.
3. Recompute the minimum distance and repeat, with finite iteration and displacement bounds. Report failure instead of silently accepting an unseated bead.
4. Validate the final own-support gap and independently check all other rails, bead pairs, and the board. Preserve previous valid centers if seating fails.

The advancement bound is a mathematical derivation, not a library guarantee: under a rigid translation of length `h`, every pairwise surface distance changes by at most `h`, by the triangle inequality. Therefore the minimum surface distance is 1-Lipschitz. A step shorter than `D − targetGap` cannot cross a surface from a valid initial state. This also avoids stepping through a thin wall and landing in another separated region, which an endpoint-only collision test can miss. Floating-point calculations still require a safety factor and final checks.

For safety against all obstacles during movement, take `D` as the minimum over own-support and other obstacle surfaces. If another obstacle limits advancement first, report it; do not mislabel its proximity as support contact. Existing 54 mm center spacings and 32 mm foreign-rail clearances must be rechecked after translations, because two moving beads can reduce their center separation.

Unsigned surface distance alone does not determine solid containment: one closed solid can be inside another without intersecting surfaces. Require a valid starting configuration and preserve it by bounded advancement; retain separate intersection/containment checks where appropriate. Open-ended TubeGeometry also makes generic inside/outside ray parity unsuitable as the sole predicate.

## Acceptance and mechanical limits

Record per bead: starting gap, final own-support gap, displacement, tangent Y component, iteration count, obstacle minimum, and any failure. Include the reported near-horizontal block case in regression evidence. Independently recompute triangle distances from final rendered transforms; a centerline or sampled-bore test cannot establish the requested less-than-0.1 mm surface gap. Measure startup cost on a representative graph before choosing live computation versus a reproducible authoring bake.

This pass produces constrained, near-contact static poses. It does not simulate a freely moving toy. Fixing rail fraction and quaternion removes sliding and tipping degrees of freedom; a real bead on a sloping wire may slide or rotate unless friction, neighboring beads, or constraints support it. Full mechanical equilibrium additionally requires force and moment balance with appropriate unilateral contact/friction assumptions. Constrained motion and gravity are treated explicitly in [MIT's primary course notes on multibody dynamics](https://underactuated.mit.edu/multibody.html). The projected-gravity rule above is a deliberately restricted authoring model derived here, not a result claimed by that source.

No full physics engine is needed to remove visible bore gaps for these fixed poses. A dynamics engine becomes justified if the product must show physically credible sliding, tipping, impacts, or settled configurations without preserving authored fractions. Triangle contact evidence supports geometric seating only; materials, lighting, manufacturing details, and image inspection remain separate requirements for photorealism.

## Follow-up: continuous triangle SAT prototype

Inspected the temporary `triangle-sweep.mjs` and `seat-ccd-prototype.mjs` supplied during implementation. A BVH-pruned triangle sweep is a reasonable faster replacement for repeated distance queries when the entire motion is a translation with fixed orientation. Eberly identifies the two triangle normals and nine edge cross products for nonparallel triangles, with six additional normal-cross-edge directions in the coplanar case. His constant-velocity extension projects moving intervals and derives first contact from their overlap times. The source's dynamic triangle discussion primarily treats noncoplanar triangles; the coplanar extension below is independently derived from the static axis set. [David Eberly, Dynamic Collision Detection using Oriented Bounding Boxes, sections 4.1–4.3.1](https://www.geometrictools.com/Documentation/DynamicCollisionDetection.pdf)

For an axis with fixed projected interval `[a0,a1]`, moving interval `[b0+s*v,b1+s*v]`, and scalar displacement `s`, overlap requires `a0-b1 <= s*v <= a1-b0`. Divide both endpoints by nonzero `v`, sort them, and intersect that interval with every other axis's interval and `[0,maximum]`. If `v=0`, require the initial intervals to overlap. The maximum entry time is the first intersection if it does not exceed the minimum exit time. This derivation matches the prototype's signs and interval update. Adding the six coplanar axes unconditionally is valid: a real intersection overlaps on every projection, so redundant axes cannot reject it in exact arithmetic. The axes stay fixed under translation, including when parallel triangles become coplanar later.

The mesh wrapper's inverse bead transform, applied to rail vertices, and negated inverse-rotated movement correctly make the bead stationary while the rail translates in the opposite direction. Its swept AABBs formed by the union of starting and ending boxes are conservative for translation. These statements assume the rail BVH uses graph/world coordinates and the bead matrix is rigid with unit scale. `transformDirection` normalizes; it would discard scale information and invalidate displacement units if arbitrary scaling were introduced. Returning only the minimum triangle-pair entry time provides first surface contact, without solving response forces or equilibrium.

Numerical and boundary qualifications:

- The prototype expands projected intervals by `1e-7` and discards very small axes. This favors early conservative contact and can create false-positive entry times. Consequently, do not label the returned value an exact mathematical TOI. Keep independent final triangle-distance and intersection validation; grazing cases deserve explicit coverage.
- In exact arithmetic, retreating 0.03 mm from true first contact along unit motion gives a final minimum surface distance at most 0.03 mm by the Lipschitz argument. Expanded intervals can return contact early, so that upper bound alone does not certify this implementation's final gap. Independent measured gaps are the acceptance evidence.
- The triangle routine returns Infinity for a triangle whose squared normal is below `1e-18`. That omits points or line segments. It is acceptable only after establishing that such triangles have no unique surface contribution, as with redundant zero-area seam triangles. Otherwise implement degenerate primitives or reject unsupported geometry. Do not silently advertise general triangle-soup CCD robustness.
- A hit exactly at the maximum search displacement is excluded by the wrapper's strict `t < first` comparison. Decide whether the bound is open or closed and test that contract. Zero-time contacts, initially intersecting meshes, parallel separated triangles, coplanar edge/vertex contact, negative projected speed, and nearly parallel triangles also need explicit treatment.
- No-hit or a failed final gap check must be visible. Maintain initial validity, check foreign rails and other beads, and retain finite search bounds. Own-rail first contact alone cannot establish whole-scene safety.

The parent agent reported a 30-bead prototype with independently checked gaps around 0.025–0.030 mm, no surface intersections, and approximately 0.95 s including final distance validation, versus approximately 5.4 s for repeated distance advancement. Those are supplied exploratory measurements, not independently rerun results in this research note, scalability guarantees, or proof over other scene sizes.
