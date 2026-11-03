import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { normalizeMappedNormals } from "../scripts/pathtracer-normal-compat.mjs";

test("normal-frame vendoring fails instead of silently skipping a changed upstream shader", async () => {
  const source = await readFile(new URL("../node_modules/three-gpu-pathtracer/src/materials/pathtracing/glsl/get_surface_record_function.glsl.js", import.meta.url), "utf8");
  for (const slot of ["normal", "clearcoatNormal"]) {
    const assignment = `${slot} = vTBN * texNormal;`;
    assert.throws(() => normalizeMappedNormals(source.replace(assignment, "")), /Expected one pinned tracer/);
    assert.throws(() => normalizeMappedNormals(source + "\n" + assignment), /Expected one pinned tracer/);
  }
});
