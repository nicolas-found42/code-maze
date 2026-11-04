import { appendFile, mkdir, readFile, rename, stat } from "node:fs/promises";
import path from "node:path";
import os from "node:os";

export const EVIDENCE_VERSION = 1;
export const DEFAULT_MAX_BYTES = 1024 * 1024;
export const DEFAULT_MAX_FILES = 5;
const MAX_LINE_BYTES = 8192;
const MAX_STRING = 400;
const MAX_MESSAGE = 300;
const SECRET_PATTERN = /pass(word)?|secret|token|credential|authorization|api[-_]?key|private[-_]?key|bearer|cookie/i;
const ACTIVE_NAME = "events.jsonl";

export function redactPath(value) {
  if (typeof value !== "string") return value;
  const home = os.homedir();
  let out = value;
  if (home && home !== "/" && (out === home || out.startsWith(home + path.sep))) out = "~" + out.slice(home.length);
  return out.length > MAX_STRING ? out.slice(0, MAX_STRING - 1) + "…" : out;
}

function clean(value, depth = 0) {
  if (typeof value === "string") return value.length > MAX_STRING ? value.slice(0, MAX_STRING - 1) + "…" : value;
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  if (typeof value === "boolean" || value === null || value === undefined) return value ?? undefined;
  if (depth >= 2) return undefined;
  if (Array.isArray(value)) return value.slice(0, 8).map((item) => clean(item, depth + 1)).filter((item) => item !== undefined);
  if (typeof value === "object") {
    const out = {};
    for (const [key, item] of Object.entries(value)) {
      if (SECRET_PATTERN.test(key)) continue;
      const cleaned = clean(item, depth + 1);
      if (cleaned !== undefined) out[key] = cleaned;
    }
    return out;
  }
  return undefined;
}

function buildEntry(component, event, fields = {}, options = {}) {
  const entry = {
    v: EVIDENCE_VERSION,
    ts: options.now(),
    component: typeof fields?.component === "string" && fields.component ? fields.component.slice(0, 40) : component,
    event: String(event).slice(0, 60),
  };
  const extra = clean(fields) || {};
  for (const key of ["op", "parent", "outcome", "durationMs"]) if (extra[key] !== undefined) entry[key] = extra[key];
  if (extra.error && typeof extra.error === "object") {
    entry.error = {};
    if (extra.error.category !== undefined) entry.error.category = String(extra.error.category).slice(0, 60);
    if (extra.error.message !== undefined) entry.error.message = String(extra.error.message).slice(0, MAX_MESSAGE);
  }
  for (const [key, value] of Object.entries(extra)) {
    if (key in entry || key === "error") continue;
    entry[key] = value;
  }
  return entry;
}

export function createEvidenceLog({
  dir,
  component = "app",
  maxBytes = DEFAULT_MAX_BYTES,
  maxFiles = DEFAULT_MAX_FILES,
  now = () => new Date().toISOString(),
  onWriteFailure,
} = {}) {
  if (!dir || typeof dir !== "string") throw new Error("Evidence log requires a directory.");
  if (!Number.isInteger(maxBytes) || maxBytes < 256) throw new Error("maxBytes must be an integer of at least 256.");
  if (!Number.isInteger(maxFiles) || maxFiles < 1 || maxFiles > 50) throw new Error("maxFiles must be an integer between 1 and 50.");
  const state = { queue: Promise.resolve(), writes: 0, writeFailures: 0, rotations: 0, droppedByOverflow: 0, closed: false, dirReady: false };
  let warned = false;
  const fail = (error) => {
    state.writeFailures += 1;
    if (!warned) {
      warned = true;
      try { onWriteFailure?.(error); } catch { /* reporting must never break the caller */ }
    }
  };
  async function write(line) {
    try {
      const file = path.join(dir, ACTIVE_NAME);
      if (!state.dirReady) {
        await mkdir(dir, { recursive: true });
        state.dirReady = true;
      }
      const info = await stat(file).catch((error) => { if (error.code === "ENOENT") return undefined; throw error; });
      if (info && info.size + line.length + 1 > maxBytes) {
        for (let target = maxFiles - 1; target >= 1; target--) {
          await rename(path.join(dir, `events.${target}.jsonl`), path.join(dir, `events.${target + 1}.jsonl`)).catch((error) => {
            if (error.code !== "ENOENT") throw error;
          });
        }
        await rename(file, path.join(dir, "events.1.jsonl"));
        state.rotations += 1;
      }
      await appendFile(file, line + "\n", "utf8");
      state.writes += 1;
    } catch (error) {
      if (error.code === "ENFILE" || error.code === "EMFILE") await new Promise((resolve) => setTimeout(resolve, 20)).catch(() => {});
      fail(error);
    }
  }
  return {
    dir,
    emit(event, fields) {
      if (state.closed) { state.writeFailures += 1; return Promise.resolve(); }
      const entry = buildEntry(component, event, fields, { now });
      let line = JSON.stringify(entry);
      if (Buffer.byteLength(line, "utf8") > MAX_LINE_BYTES) {
        const slim = {
          v: entry.v, ts: entry.ts, component: entry.component, event: entry.event,
          truncated: true,
          droppedFields: Object.keys(entry).filter((key) => !["v", "ts", "component", "event"].includes(key) && !SECRET_PATTERN.test(key)),
        };
        line = JSON.stringify(slim);
        state.droppedByOverflow += 1;
      }
      state.queue = state.queue.then(() => write(line)).catch(() => { /* write() reports failures through stats, never through rejection */ });
      return state.queue;
    },
    close() {
      state.closed = true;
      return state.queue.then(() => undefined);
    },
    stats() {
      return {
        dir: redactPath(dir),
        writes: state.writes,
        writeFailures: state.writeFailures,
        rotations: state.rotations,
        droppedByOverflow: state.droppedByOverflow,
        closed: state.closed,
      };
    },
  };
}

function parseTimestamp(value) {
  if (value === undefined || value === null || value === "") return undefined;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function within(timestamp, since, until) {
  const time = Date.parse(timestamp);
  if (Number.isNaN(time)) return false;
  if (since && time < since.getTime()) return false;
  if (until && time > until.getTime()) return false;
  return true;
}

export async function readEvents({
  dir,
  since,
  until,
  component,
  event,
  op,
  includeChildren = false,
  limit = 200,
  maxFiles = DEFAULT_MAX_FILES,
} = {}) {
  if (!dir || typeof dir !== "string") throw new Error("readEvents requires a directory.");
  const bounds = { since: parseTimestamp(since), until: parseTimestamp(until) };
  const cappedLimit = Math.max(1, Math.min(1000, Math.floor(limit) || 200));
  const names = [ACTIVE_NAME, ...Array.from({ length: maxFiles - 1 }, (_, index) => `events.${index + 1}.jsonl`)].reverse();
  const files = [];
  const collected = [];
  let corrupt = 0;
  let totalLines = 0;
  let missing = true;
  for (const name of names) {
    let text;
    try {
      text = await readFile(path.join(dir, name), "utf8");
    } catch (error) {
      if (error.code === "ENOENT") continue;
      files.push({ name, error: error.code || error.message });
      continue;
    }
    missing = false;
    const lines = text.split("\n").filter((line) => line.length > 0);
    const summary = { name, lines: lines.length, corrupt: 0, bytes: Buffer.byteLength(text, "utf8"), firstTs: undefined, lastTs: undefined };
    for (const line of lines) {
      let entry;
      try { entry = JSON.parse(line); } catch { summary.corrupt += 1; continue; }
      if (!entry || typeof entry !== "object" || typeof entry.ts !== "string" || typeof entry.event !== "string") { summary.corrupt += 1; continue; }
      totalLines += 1;
      if (summary.firstTs === undefined) summary.firstTs = entry.ts;
      summary.lastTs = entry.ts;
      if (!within(entry.ts, bounds.since, bounds.until)) continue;
      if (component && entry.component !== component) continue;
      if (event && entry.event !== event) continue;
      if (op) {
        if (entry.op !== op && entry.parent !== op && !(includeChildren && collected.some((item) => item.op === entry.parent))) continue;
      }
      collected.push(entry);
    }
    corrupt += summary.corrupt;
    files.push(summary);
  }
  const matching = collected.length;
  const events = includeChildren && op ? expandChildren(collected, op) : collected;
  return {
    events: events.slice(0, cappedLimit),
    matching,
    truncated: events.length > cappedLimit,
    corrupt,
    totalLines,
    missing,
    files,
    range: rangeOf(files),
  };
}

function expandChildren(events, rootOp) {
  const keep = new Set();
  const byParent = new Map();
  for (const entry of events) {
    if (entry.op === rootOp || entry.parent === rootOp) keep.add(entry);
    if (typeof entry.parent === "string") {
      if (!byParent.has(entry.parent)) byParent.set(entry.parent, []);
      byParent.get(entry.parent).push(entry);
    }
  }
  let frontier = [...keep];
  while (frontier.length) {
    const next = [];
    for (const entry of frontier) {
      if (typeof entry.op !== "string") continue;
      for (const child of byParent.get(entry.op) || []) {
        if (!keep.has(child)) { keep.add(child); next.push(child); }
      }
    }
    frontier = next;
    if (keep.size > 500) break;
  }
  return events.filter((entry) => keep.has(entry));
}

function rangeOf(files) {
  const stamps = files.flatMap((file) => [file.firstTs, file.lastTs]).filter(Boolean).sort();
  return stamps.length ? { earliest: stamps[0], latest: stamps[stamps.length - 1] } : undefined;
}
