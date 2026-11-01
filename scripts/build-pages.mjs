import { cpSync, existsSync, mkdirSync, rmSync, statSync } from "node:fs";
import { dirname, join } from "node:path";

const OUT = "_site";
const SITE_FILES = [
  "index.html",
  "workshop.html",
  "docs/prompt-workshop.md",
  "docs/bead-maze-photo3d.html",
  "docs/codebase-bead-maze.html",
  "docs/bead-fallback.js",
  "docs/bead-maze-render-final.png",
  "docs/bead-maze-view-top.png",
  "docs/bead-maze-view-top-depth.png",
  "docs/bead-maze-view-top-backdrop.jpg",
  "docs/bead-maze-view-threequarter.png",
  "docs/bead-maze-view-threequarter-depth.png",
  "docs/bead-maze-view-threequarter-backdrop.jpg",
  "docs/bead-maze-view-front.png",
  "docs/bead-maze-view-front-depth.png",
  "docs/bead-maze-view-front-backdrop.jpg",
];
const SITE_DIRS = ["app", "data", "styles", "assets", "images", "fonts", "docs/vendor"];

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

for (const file of SITE_FILES) {
  if (!existsSync(file)) throw new Error(`missing site file: ${file}`);
  const destination = join(OUT, file);
  mkdirSync(dirname(destination), { recursive: true });
  cpSync(file, destination);
}

for (const entry of SITE_DIRS) {
  if (existsSync(entry) && statSync(entry).isDirectory()) {
    cpSync(entry, `${OUT}/${entry}`, { recursive: true });
  }
}
const WASM_SOURCE = "generator/target/wasm32-unknown-unknown/release/prompt_workshop.wasm";
if (!existsSync(WASM_SOURCE)) {
  throw new Error(`missing ${WASM_SOURCE}; run npm run build to compile the Rust engine`);
}
mkdirSync(join(OUT, "wasm"), { recursive: true });
cpSync(WASM_SOURCE, join(OUT, "wasm/prompt_workshop.wasm"));

console.log(`built ${OUT}/`);
