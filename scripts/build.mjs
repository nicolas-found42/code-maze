import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { scanRepository } from "../lib/scan-repository.mjs";

const root = new URL("../", import.meta.url);
const output = new URL("dist/", root);

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });

for (const name of ["index.html", "docs", "LICENSE"]) {
  await cp(new URL(name, root), new URL(name, output), { recursive: true });
}

const graph = new URL("docs/repository-map.json", output);
try { await readFile(graph); }
catch (error) {
  if (error.code !== "ENOENT") throw error;
  await writeFile(graph, JSON.stringify(await scanRepository(fileURLToPath(root)), null, 2) + "\n");
}
const page = new URL("docs/codebase-bead-maze.html", output);
await writeFile(page, (await readFile(page, "utf8")).replace('data-source="live"', 'data-source="snapshot"'));

console.log(`Built static site in ${fileURLToPath(output)}`);
