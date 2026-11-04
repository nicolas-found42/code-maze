import { mkdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { scanRepository, classifyScanError } from "../lib/scan-repository.mjs";
import { createEvidenceLog, redactPath } from "../lib/evidence.mjs";

const evidence = createEvidenceLog({
  dir: process.env.CODE_MAZE_EVIDENCE_DIR || fileURLToPath(new URL("../.evidence", import.meta.url)),
  component: "scan",
  onWriteFailure: (error) => console.error(`Evidence store write failed: ${error.message}`),
});
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
  const started = performance.now();
  evidence.emit("scan.start", { mode: "cli", root: redactPath(path.resolve(input)), maxFiles });
  const graph = await scanRepository(input, { maxFiles });
  await mkdir(path.dirname(output), { recursive: true });
  const temporary = `${output}.${process.pid}.tmp`;
  await writeFile(temporary, JSON.stringify(graph, null, 2) + "\n");
  await rename(temporary, output);
  evidence.emit("scan.finish", {
    outcome: "success",
    durationMs: Math.round(performance.now() - started),
    nodes: graph.nodes.length,
    edges: graph.edges.length,
    groups: graph.groups.length,
    warnings: graph.warnings.length,
    output: redactPath(output),
  });
  console.log(`${graph.repository.name}: ${graph.nodes.length} files, ${graph.edges.length} relationships, ${graph.groups.length} groups.\nSaved ${output}`);
  for (const warning of graph.warnings) console.warn(warning);
} catch (error) {
  evidence.emit("scan.finish", {
    outcome: "failure",
    error: { category: classifyScanError(error), message: error.message },
  });
  console.error(`Scan failed: ${error.message}`);
  process.exitCode = 1;
} finally {
  await evidence.close();
}
