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
    stdin: { contents: "export { MaterialsTexture } from 'three-gpu-pathtracer/src/uniforms/MaterialsTexture.js';", resolveDir: process.cwd() },
    bundle: true, format: "esm", write: false,
    plugins: [{ name: "shared-three", setup(b) {
      b.onResolve({ filter: /^three$/ }, () => ({ path: "/docs/vendor/three.module.js", external: true }));
    } }],
  });
  browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || "chrome" });
  const page = await browser.newPage();
  const errors = []; page.on("pageerror", e => errors.push(e.message));
  await page.route("**/material-encoder.js", route => route.fulfill({ contentType: "text/javascript", body: bundle.outputFiles[0].text }));
  await page.goto(`http://127.0.0.1:${app.address().port}/docs/codebase-bead-maze.html`);
  const observed = await page.evaluate(async () => {
    const THREE = await import("./vendor/three.module.js");
    const { createToyMaterials } = await import("./bead-materials.js");
    const { MaterialsTexture } = await import("./material-encoder.js");
    const materials = createToyMaterials(THREE, { capabilities: { getMaxAnisotropy: () => 1 } }, () => {});
    const encoder = new MaterialsTexture();
    function inspect(material) {
      const map = material.normalMap;
      encoder.updateFrom([material], [map]);
      const canvas = map.image, pixels = canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height).data;
      let detailed = 0;
      for (let i = 0; i < pixels.length; i += 4) if (Math.abs(pixels[i] - 128) > 1 || Math.abs(pixels[i + 1] - 128) > 1) detailed++;
      return { normalIndex: encoder.image.data[16], normalScale: [...encoder.image.data.slice(17, 19)], bump: Boolean(material.bumpMap), colorSpace: map.colorSpace, detailed };
    }
    const result = { ply: inspect(materials.ply), paint: inspect(materials.bead(0xff0000)[0]) };
    encoder.dispose();
    return result;
  });
  for (const [name, finish] of Object.entries(observed)) {
    assert.equal(finish.normalIndex, 0, `${name} relief reaches the actual tracer`);
    assert.deepEqual(finish.normalScale, [1, 1]);
    assert.equal(finish.bump, false);
    assert.equal(finish.colorSpace, "", "normal data is not gamma encoded");
    assert.ok(finish.detailed > 1000, `${name} normal is not a flat placeholder`);
  }
  assert.deepEqual(errors, []);
  console.log("Browser material → pinned tracer normal encoding:", JSON.stringify(observed));
} finally {
  await browser?.close(); app.closeAllConnections(); app.close();
}
