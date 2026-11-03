import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { chromium } from "playwright";
import { createPlywoodFinish, PLY_HEIGHT, PLY_LAYERS, PLY_REPEAT, PLY_SIZE } from "../docs/plywood-finish.js";
import { normalsFromHeight } from "../docs/finish-normals.js";

const input = "docs/vendor/white_maple_veneer_diff_1k.jpg";
const sources = [input, "docs/plywood-finish.js", "docs/finish-normals.js", "scripts/bake-plywood.mjs"];
const hash = data => createHash("sha256").update(data).digest("hex");
let browser;
try {
  browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || "chrome" });
  const page = await browser.newPage();
  const result = await page.evaluate(async ({ jpeg, author, helper, constants }) => {
    const { PLY_HEIGHT, PLY_LAYERS, PLY_REPEAT, PLY_SIZE } = constants;
    const normalsFromHeight = eval(`(${helper})`);
    const createPlywoodFinish = eval(`(${author})`);
    const image = await createImageBitmap(await (await fetch(`data:image/jpeg;base64,${jpeg}`)).blob());
    const source = document.createElement("canvas"); source.width = image.width; source.height = image.height;
    const context = source.getContext("2d"); context.drawImage(image, 0, 0); image.close();
    const finish = createPlywoodFinish(context.getImageData(0, 0, source.width, source.height));
    const output = {};
    for (const key of ["color", "normal"]) {
      const canvas = document.createElement("canvas"); canvas.width = finish.width; canvas.height = finish.height;
      const ctx = canvas.getContext("2d"), pixels = ctx.createImageData(canvas.width, canvas.height);
      pixels.data.set(finish[key]); ctx.putImageData(pixels, 0, 0); output[key] = canvas.toDataURL("image/png").split(",")[1];
    }
    return { output, bands: finish.bands };
  }, { jpeg: (await readFile(input)).toString("base64"), author: createPlywoodFinish.toString(), helper: normalsFromHeight.toString(),
    constants: { PLY_HEIGHT, PLY_LAYERS, PLY_REPEAT, PLY_SIZE } });
  const manifest = { description: "Authored photo-derived plywood hybrid, not a scan or catalog32mm construction", inputs: {}, outputs: {},
    settings: { heightMm: PLY_HEIGHT, layers: PLY_LAYERS, repeatMm: PLY_REPEAT, size: PLY_SIZE }, bands: result.bands };
  for (const name of sources) manifest.inputs[name] = hash(await readFile(name));
  for (const [key, encoded] of Object.entries(result.output)) {
    const name = `docs/vendor/birch_ply_edge_${key}_1k.png`, bytes = Buffer.from(encoded, "base64");
    await writeFile(name, bytes); manifest.outputs[name] = { bytes: bytes.length, sha256: hash(bytes) };
  }
  await writeFile("docs/vendor/plywood-finish.json", JSON.stringify(manifest, null, 2) + "\n");
  console.log("Baked plywood hybrid:", JSON.stringify({ settings: manifest.settings, outputs: manifest.outputs }));
} finally { await browser?.close(); }
