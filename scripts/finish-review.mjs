import assert from "node:assert/strict";
import { once } from "node:events";
import { build } from "esbuild";
import { chromium } from "playwright";
import { createApp } from "./server.mjs";

// Exercise the actual browser material factory and the pinned tracer encoder.
// This catches bump-only materials silently losing relief at the export seam.
const app = createApp(); let browser;
try {
  app.listen(0, "127.0.0.1"); await once(app, "listening");
  const bundle = await build({
    stdin: { contents: "export { MaterialsTexture } from 'three-gpu-pathtracer/src/uniforms/MaterialsTexture.js'; export { RenderTarget2DArray } from 'three-gpu-pathtracer/src/uniforms/RenderTarget2DArray.js'; export { FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass.js';", resolveDir: process.cwd() },
    bundle: true, format: "esm", write: false,
    plugins: [{ name: "shared-three", setup(b) {
      b.onResolve({ filter: /^three$/ }, () => ({ path: "/docs/vendor/three.module.js", external: true }));
    } }],
  });
  browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || "chrome" });
  const page = await browser.newPage();
  const errors = []; page.on("pageerror", e => errors.push(e.message));
  page.on("console", m => { if (m.type() === "error") errors.push(m.text()); });
  await page.route("**/material-encoder.js", route => route.fulfill({ contentType: "text/javascript", body: bundle.outputFiles[0].text }));
  await page.goto(`http://127.0.0.1:${app.address().port}/docs/codebase-bead-maze.html`);
  const observed = await page.evaluate(async () => {
    const THREE = await import("./vendor/three.module.js");
    const { createToyMaterials } = await import("./bead-materials.js");
    const { MaterialsTexture, RenderTarget2DArray, FullScreenQuad } = await import("./material-encoder.js");
    const materials = createToyMaterials(THREE, { capabilities: { getMaxAnisotropy: () => 1 } }, () => {});
    await materials.ready;
    const encoder = new MaterialsTexture();
    function inspect(material) {
      const map = material.normalMap;
      encoder.updateFrom([material], [map]);
      const canvas = document.createElement("canvas"), image = map.image;
      canvas.width = image.width; canvas.height = image.height;
      const context = canvas.getContext("2d"); context.drawImage(image, 0, 0);
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
      let detailed = 0;
      for (let i = 0; i < pixels.length; i += 4) if (Math.abs(pixels[i] - 128) > 1 || Math.abs(pixels[i + 1] - 128) > 1) detailed++;
      return { normalIndex: encoder.image.data[16], normalScale: [...encoder.image.data.slice(17, 19)], bump: Boolean(material.bumpMap), colorSpace: map.colorSpace, detailed };
    }
    const result = { ply: inspect(materials.ply), paint: inspect(materials.bead(0xff0000)[0]) };
    // Exercise actual GPU source-vs-packed border sampling. The pinned array
    // repeats both axes, regardless of each source map's requested clamping.
    const renderer = new THREE.WebGLRenderer();
    renderer.toneMapping = THREE.NoToneMapping; renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    const packed = new RenderTarget2DArray(1024, 1024), target = new THREE.WebGLRenderTarget(64, 2);
    materials.ply.map.updateMatrix();
    packed.setTextures(renderer, [materials.ply.map]);
    const shader = new THREE.RawShaderMaterial({ glslVersion: THREE.GLSL3,
      uniforms: { original: { value: materials.ply.map }, packed: { value: packed.texture }, transform: { value: materials.ply.map.matrix.clone() } },
      vertexShader: "precision highp float;in vec3 position;void main(){gl_Position=vec4(position.xy,0.,1.);}",
      fragmentShader: `precision highp float;precision highp sampler2DArray;
        uniform sampler2D original;uniform sampler2DArray packed;uniform mat3 transform;out vec4 color;
        void main(){float u=(floor(gl_FragCoord.x/2.)+.5)/32.;float v=gl_FragCoord.y<1.?0.:1.;
        vec2 uv=(transform*vec3(u,v,1.)).xy;
        color=mod(floor(gl_FragCoord.x),2.)<.5?textureLod(original,uv,0.):textureLod(packed,vec3(uv,0.),0.);}`,
    });
    const quad = new FullScreenQuad(shader), pixels = new Uint8Array(64 * 2 * 4);
    try {
      renderer.setRenderTarget(target); quad.render(renderer); renderer.readRenderTargetPixels(target, 0, 0, 64, 2, pixels);
      let maximum = 0, minimumAlpha = 255, maximumColor = 0;
      for (let y = 0; y < 2; y++) for (let x = 0; x < 64; x += 2) {
        const offset = (y * 64 + x) * 4;
        minimumAlpha = Math.min(minimumAlpha, pixels[offset + 3], pixels[offset + 7]);
        for (let c = 0; c < 3; c++) { maximum = Math.max(maximum, Math.abs(pixels[offset + c] - pixels[offset + 4 + c])); maximumColor = Math.max(maximumColor, pixels[offset + c]); }
      }
      result.border = { maximum, minimumAlpha, maximumColor };
    } finally {
      shader.dispose(); quad.dispose(); target.dispose(); packed.fsQuad.material.dispose(); packed.dispose();
      renderer.dispose(); renderer.forceContextLoss();
    }
    encoder.dispose();
    return result;
  });
  for (const [name, finish] of Object.entries(observed)) {
    if (name === "border") continue;
    assert.equal(finish.normalIndex, 0, `${name} relief reaches the actual tracer`);
    assert.deepEqual(finish.normalScale, [1, 1]);
    assert.equal(finish.bump, false);
    assert.equal(finish.colorSpace, "", "normal data is not gamma encoded");
    assert.ok(finish.detailed > 1000, `${name} normal is not a flat placeholder`);
  }
  console.log("Actual GPU packed-border probe:", JSON.stringify(observed.border));
  assert.equal(observed.border.minimumAlpha, 255, "probe actually draws every sample");
  assert.ok(observed.border.maximumColor > 50, "probe is not a black placeholder");
  assert.ok(observed.border.maximum <= 1, "packed-array/source border sampling differs beyond8bit quantization");
  assert.deepEqual(errors, []);
  console.log("Browser material → pinned tracer normal encoding:", JSON.stringify(observed));
} finally {
  await browser?.close(); app.closeAllConnections(); app.close();
}
