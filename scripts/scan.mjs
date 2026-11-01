import { mkdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { scanRepository } from "../lib/scan-repository.mjs";

try {
  const args = process.argv.slice(2);
  const input = args.shift() || ".";
  let output = fileURLToPath(new URL("../docs/repository-map.json", import.meta.url));
  let maxFiles = 600;
  while (args.length) {
    const option = args.shift();
    if (option === "--output" && args.length) output = path.resolve(args.shift());
    else if (option === "--max-files" && args.length) maxFiles = Number(args.shift());
    else throw new Error(`Unknown or incomplete option: ${option}`);
  }
  const graph = await scanRepository(input, { maxFiles });
  await mkdir(path.dirname(output), { recursive: true });
  const temporary = `${output}.${process.pid}.tmp`;
  await writeFile(temporary, JSON.stringify(graph, null, 2) + "\n");
  await rename(temporary, output);
  console.log(`${graph.repository.name}: ${graph.nodes.length} files, ${graph.edges.length} relationships, ${graph.groups.length} groups.\nSaved ${output}`);
  for (const warning of graph.warnings) console.warn(warning);
} catch (error) {
  console.error(`Scan failed: ${error.message}`);
  process.exitCode = 1;
}
