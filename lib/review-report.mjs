import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

// Writes a machine-readable failure report that survives the process, next to
// the review artifacts. Never overwrites: each report is stamped with UTC time.
export async function writeFailureReport(outDir, label, details = {}) {
  const capturedAt = new Date().toISOString();
  const stamp = capturedAt.replace(/[:.]/g, "-");
  const file = path.join(outDir, "failures", `${label}-${stamp}.json`);
  await mkdir(path.dirname(file), { recursive: true });
  const error = details.error;
  const report = {
    v: 1,
    label,
    capturedAt,
    ...details,
    error: error && typeof error === "object"
      ? { category: error.name || "error", message: error.message, stack: error.stack }
      : undefined,
  };
  if (!report.error) delete report.error;
  await writeFile(file, JSON.stringify(report, null, 2) + "\n", "utf8");
  console.error(`Failure report: ${file}`);
  return file;
}
