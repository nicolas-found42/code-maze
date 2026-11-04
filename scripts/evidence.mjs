import { readEvents, redactPath } from "../lib/evidence.mjs";
import { readFile } from "node:fs/promises";

const USAGE = `Inspect the Code Maze evidence store.

Usage:
  node scripts/evidence.mjs list   [--since ISO] [--until ISO] [--component C] [--event E]
                                   [--op ID] [--children] [--limit N] [--tz ZONE] [--json] [--dir D]
  node scripts/evidence.mjs show OP [--tz ZONE] [--json] [--dir D]
  node scripts/evidence.mjs summary [--tz ZONE] [--json] [--dir D]

Times are UTC ISO-8601 by default; a timestamp without an offset is read as UTC.
--tz accepts an IANA zone (for example --tz America/New_York) for display only.
Exit codes: 0 success, 1 usage error, 2 no evidence store found.`;

function fail(message, code = 1) {
  console.error(message);
  process.exitCode = code;
}

function formatter(zone) {
  const format = new Intl.DateTimeFormat("en-CA", {
    timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", fractionalSecondDigits: 3, hour12: false,
  });
  return (iso) => {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return iso;
    const parts = Object.fromEntries(format.formatToParts(date).map((part) => [part.type, part.value]));
    return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}.${parts.fractionalSecond ?? parts.millisecond ?? "000"}`;
  };
}

function parseTimestamp(value, label, notices) {
  if (!value) return undefined;
  if (!/^\d{4}-\d{2}-\d{2}/.test(value)) {
    fail(`${label} must look like an ISO-8601 timestamp (e.g. 2026-11-04T10:00:00Z).`);
    return undefined;
  }
  if (!/[zZ]|[+-]\d{2}:?\d{2}$/.test(value)) notices.push(`${label} "${value}" has no timezone; interpreted as UTC.`);
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) { fail(`${label} is not a valid timestamp: ${value}`); return undefined; }
  return date;
}

function short(value) { return typeof value === "string" && value.length > 10 ? value.slice(0, 8) + "…" : value; }

function eventLine(entry, formatTs) {
  const bits = [
    formatTs(entry.ts),
    entry.component,
    entry.event,
  ];
  if (entry.outcome) bits.push(entry.outcome);
  if (typeof entry.durationMs === "number") bits.push(`${entry.durationMs}ms`);
  if (entry.op) bits.push(`op=${short(entry.op)}`);
  if (entry.parent) bits.push(`parent=${short(entry.parent)}`);
  let line = bits.join(" ");
  if (entry.error) line += ` error=${entry.error.category || "unknown"} "${String(entry.error.message || "").slice(0, 200)}"`;
  const known = new Set(["v", "ts", "component", "event", "outcome", "durationMs", "op", "parent", "error"]);
  for (const [key, value] of Object.entries(entry)) {
    if (known.has(key) || value === undefined) continue;
    line += ` ${key}=${typeof value === "object" ? JSON.stringify(redactPath(value)) : String(value)}`;
  }
  return line;
}

function header(result, dir, formatTs) {
  const files = result.files.map((file) => `${file.name} (${file.lines} lines${file.corrupt ? `, ${file.corrupt} corrupt` : ""})`);
  console.log(`Evidence store: ${dir}`);
  console.log(`Files inspected: ${files.length ? files.join(", ") : "none present"}`);
  if (result.range) console.log(`Range covered: ${formatTs(result.range.earliest)} .. ${formatTs(result.range.latest)} (${result.range.earliest.slice(-1) === "Z" ? "UTC ISO" : "local"} timestamps)`);
  if (result.corrupt) console.log(`Corrupt lines skipped: ${result.corrupt} (retained on disk, unparseable)`);
}

async function main() {
  const args = process.argv.slice(2);
  const command = args.shift() || "list";
  if (command === "help" || command === "--help" || command === "-h") { console.log(USAGE); return; }
  const options = { children: false, json: false, zone: "UTC", limit: 200, since: undefined, until: undefined, component: undefined, event: undefined, op: undefined, dir: undefined };
  const positional = [];
  while (args.length) {
    const flag = args.shift();
    const value = () => { if (!args.length) { fail(`Missing value for ${flag}`); process.exit(process.exitCode || 1); } return args.shift(); };
    if (flag === "--since") options.since = value();
    else if (flag === "--until") options.until = value();
    else if (flag === "--component") options.component = value();
    else if (flag === "--event") options.event = value();
    else if (flag === "--op") options.op = value();
    else if (flag === "--children") options.children = true;
    else if (flag === "--limit") options.limit = Number(value());
    else if (flag === "--tz") options.zone = value();
    else if (flag === "--json") options.json = true;
    else if (flag === "--dir") options.dir = value();
    else if (flag.startsWith("-")) { fail(`Unknown option: ${flag}\n${USAGE}`); return; }
    else positional.push(flag);
  }
  if (command === "show") options.op = options.op || positional[0];
  const notices = [];
  const since = parseTimestamp(options.since, "--since", notices);
  const until = parseTimestamp(options.until, "--until", notices);
  if (process.exitCode) return;
  let formatTs;
  try { formatTs = formatter(options.zone); } catch { fail(`Unknown time zone: ${options.zone}`); return; }
  const dir = options.dir || process.env.CODE_MAZE_EVIDENCE_DIR || new URL("../.evidence", import.meta.url).pathname;
  const result = await readEvents({ dir, since, until, component: options.component, event: options.event, op: options.op, includeChildren: options.children, limit: options.limit });
  if (result.missing) {
    fail(`No evidence store found at ${redactPath(String(dir))}.\nEither the server or scan CLI never ran with evidence enabled, or the directory was removed.\nThis is different from "no matching events": nothing has been recorded here at all.`, 2);
    return;
  }
  for (const notice of notices) console.warn(`Note: ${notice}`);
  if (command === "summary") {
    const version = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8")).version;
    const counts = {};
    const outcomes = {};
    const starts = [];
    const failures = [];
    for (const entry of result.events) {
      counts[entry.component] = (counts[entry.component] || 0) + 1;
      if (entry.outcome) outcomes[entry.outcome] = (outcomes[entry.outcome] || 0) + 1;
      if (entry.event === "server.start") starts.push(entry);
      if (entry.outcome === "failure") failures.push(entry);
    }
    if (options.json) {
      console.log(JSON.stringify({ dir: redactPath(dir), version, files: result.files, corrupt: result.corrupt, totalLines: result.totalLines, range: result.range, components: counts, outcomes, serverStarts: starts, failures: failures.slice(-10) }, null, 2));
    } else {
      console.log(`Code Maze evidence summary (tooling ${version})`);
      header(result, redactPath(dir), formatTs);
      console.log(`Events read (current window): ${result.matching} matching of ${result.totalLines} stored lines${result.truncated ? ` [showing first ${result.events.length}]` : ""}`);
      console.log(`Components: ${Object.entries(counts).map(([key, count]) => `${key}=${count}`).join(", ") || "none"}`);
      console.log(`Outcomes: ${Object.entries(outcomes).map(([key, count]) => `${key}=${count}`).join(", ") || "none"}`);
      if (starts.length) console.log(`Server runs: ${starts.map((entry) => `${formatTs(entry.ts)} pid=${entry.pid} port=${entry.port} v${entry.version}`).join("; ")}`);
      else console.log("Server runs: none recorded in this window.");
      if (failures.length) {
        console.log(`Recent failures (last ${Math.min(10, failures.length)}):`);
        for (const entry of failures.slice(-10)) console.log(`  ${eventLine(entry, formatTs)}`);
      } else console.log("Recent failures: none in this window (absence of records here is not proof an event never happened; check the store range above).");
    }
    return;
  }
  if (command === "show") {
    if (!options.op) { fail("show requires an operation id: node scripts/evidence.mjs show <op>"); return; }
    const chain = await readEvents({ dir, op: options.op, includeChildren: true, limit: 1000 });
    if (!chain.events.length) {
      console.log(`No matching events for op ${options.op}.`);
      header(chain, redactPath(dir), formatTs);
      return;
    }
    header(chain, redactPath(dir), formatTs);
    console.log(`Chain for op ${options.op}: ${chain.events.length} event(s)`);
    for (const entry of chain.events.sort((a, b) => a.ts.localeCompare(b.ts))) console.log(`  ${eventLine(entry, formatTs)}`);
    return;
  }
  if (command !== "list") { fail(`Unknown command: ${command}\n${USAGE}`); return; }
  if (!result.events.length) {
    console.log(`No matching events (0 of ${result.totalLines} stored lines${result.corrupt ? `; ${result.corrupt} corrupt lines skipped` : ""}).`);
    header(result, redactPath(dir), formatTs);
    console.log("This means: the store exists and holds the lines above, but none matched your filters in the covered range.");
    return;
  }
  header(result, redactPath(dir), formatTs);
  console.log(`Matching events: ${result.matching}${result.truncated ? ` [showing first ${result.events.length}; raise --limit]` : ""}`);
  for (const entry of result.events) console.log(eventLine(entry, formatTs));
}

await main();
