import { build } from "esbuild";
import { cp, readFile } from "node:fs/promises";
import { REVISION } from "three";

const core = await readFile("docs/vendor/three.module.js", "utf8");
if (!core.includes(`const REVISION = "${REVISION}";`) && !core.includes(`const REVISION = '${REVISION}';`)) {
  throw new Error("Installed Three and the browser vendor revision differ; update the shared core intentionally before rebuilding tools.");
}

// Externalizing Three is essential: the viewer, addons and passes share r160.
await build({
  stdin: { contents: `
    export { EffectComposer, RenderPass, EffectPass, ToneMappingEffect, ToneMappingMode, FXAAEffect } from 'postprocessing';
    export { N8AOPostPass } from 'n8ao/src/N8AOPostPass.js';
    export { FullScreenTriangle } from 'n8ao/src/FullScreenTriangle.js';
    export { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
  `, resolveDir: process.cwd() },
  bundle: true, format: "esm", minify: true, legalComments: "eof",
  outfile: "docs/vendor/fidelity.js",
  plugins: [{ name: "shared-three", setup(builder) {
    builder.onResolve({ filter: /^three$/ }, () => ({ path: "./three.module.js", external: true }));
  } }],
});
for (const [packageName, license] of [["n8ao", "LICENSE"], ["postprocessing", "LICENSE.md"], ["three", "LICENSE"], ["three-bvh-csg", "LICENSE"], ["three-mesh-bvh", "LICENSE"]]) {
  await cp(`node_modules/${packageName}/${license}`, `docs/vendor/${packageName}.LICENSE`);
}
// Keep the progressive renderer lazy and separate from the interactive bundle.
// v0.0.23 declares r151+ support but assumes Scene rotation fields from r163.
// Virtual dispatch also covers the empty Scene created inside its constructor.
await build({
  stdin: { contents: `
    import { Euler } from 'three';
    import { WebGLPathTracer } from 'three-gpu-pathtracer';
    export { PhysicalCamera, GradientEquirectTexture, DenoiseMaterial } from 'three-gpu-pathtracer';
    export { FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass.js';
    export class StudioPathTracer extends WebGLPathTracer {
      updateEnvironment() {
        this.scene.backgroundRotation ??= new Euler();
        this.scene.environmentRotation ??= new Euler();
        super.updateEnvironment();
      }
    }
  `, resolveDir: process.cwd() },
  bundle: true, format: "esm", minify: true, legalComments: "eof",
  outfile: "docs/vendor/pathtracer.js",
  plugins: [{ name: "shared-three", setup(builder) {
    builder.onResolve({ filter: /^three$/ }, () => ({ path: "./three.module.js", external: true }));
  } }],
});
await cp("node_modules/three-gpu-pathtracer/LICENSE", "docs/vendor/three-gpu-pathtracer.LICENSE");
console.log("Built offline fidelity tools with one external Three module.");
