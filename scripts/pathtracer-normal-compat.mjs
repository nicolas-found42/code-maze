// v0.0.23 scales the mapped normal's XY components but builds its BRDF
// frame before restoring unit length. Patch the pinned source during bundling,
// and fail explicitly if an upstream change makes either replacement ambiguous.
export function normalizeMappedNormals(source) {
  for (const slot of ["normal", "clearcoatNormal"]) {
    const assignment = `${slot} = vTBN * texNormal;`;
    if (source.split(assignment).length !== 2) {
      throw new Error(`Expected one pinned tracer ${slot} assignment`);
    }
    source = source.replace(assignment, `${slot} = normalize( vTBN * texNormal );`);
  }
  return source;
}
