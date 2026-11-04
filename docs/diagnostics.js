// Diagnostics ring for browser-side failure evidence. Records bounded events,
// persists them across reloads in sessionStorage, and ships them to the local
// server so failures survive the tab. Recording and sending must never change
// application behavior.
const EVENT_LIMIT = 60;
const STORE_BYTES = 24000;
const FLUSH_LIMIT = 40;
const RENDERER_KEYS = ["renderer", "shading", "support", "photo", "photoDenoising", "photoSamples", "photoFinish", "denoising", "selected", "nodes"];
const SECRET_PATTERN = /pass(word)?|secret|token|credential|authorization|api[-_]?key|cookie|bearer/i;

function truncate(value, limit) { return value.length > limit ? value.slice(0, limit - 1) + "…" : value; }

function cleanFields(fields) {
  if (!fields || typeof fields !== "object") return {};
  const out = {};
  for (const [key, value] of Object.entries(fields)) {
    if (SECRET_PATTERN.test(key)) continue;
    if (typeof value === "string") out[key] = truncate(value, 300);
    else if (typeof value === "number" && Number.isFinite(value)) out[key] = value;
    else if (typeof value === "boolean") out[key] = value;
  }
  return out;
}

function pickRenderer(snapshot) {
  if (!snapshot || typeof snapshot !== "object") return {};
  const out = {};
  for (const key of RENDERER_KEYS) {
    const value = snapshot[key];
    if (typeof value === "string" && value) out[key] = truncate(value, 40);
  }
  return out;
}

export function createDiagnostics({
  storage = globalThis.sessionStorage,
  persistent = globalThis.localStorage,
  now = () => new Date().toISOString(),
  clock = () => (globalThis.performance?.now?.() ?? Date.now()),
  random = () => globalThis.crypto?.randomUUID?.() ?? `sess-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  send = (payload) => fetch("/api/diagnostics", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }),
  snapshot = () => ({}),
} = {}) {
  const SESSION_KEY = "code-maze:session";
  const STORE_KEY = "code-maze:diagnostics";
  let sessionId;
  try {
    sessionId = persistent?.getItem(SESSION_KEY);
    if (!sessionId) { sessionId = random(); persistent?.setItem(SESSION_KEY, sessionId); }
  } catch { sessionId = random(); }
  let events = [];
  let lost = 0;
  try {
    const restored = JSON.parse(storage?.getItem(STORE_KEY) || "");
    if (restored?.v === 1 && Array.isArray(restored.events)) events = restored.events.filter((item) => item && typeof item.event === "string").slice(-EVENT_LIMIT);
  } catch { /* first visit or unreadable prior state: start empty */ }
  function persist() {
    let payload = { v: 1, sessionId, events };
    let text = JSON.stringify(payload);
    while (text.length > STORE_BYTES && events.length > 1) {
      events = events.slice(Math.floor(events.length / 2));
      lost += Math.max(0, payload.events.length - events.length);
      payload = { v: 1, sessionId, events };
      text = JSON.stringify(payload);
    }
    try { storage?.setItem(STORE_KEY, text); } catch {
      if (events.length > 4) {
        try { storage?.setItem(STORE_KEY, JSON.stringify({ v: 1, sessionId, events: events.slice(-4) })); } catch { lost += events.length; events = events.slice(-4); }
      }
    }
  }
  function record(spec) {
    if (!spec || typeof spec.event !== "string" || !spec.event) return undefined;
    const entry = {
      ts: now(),
      component: typeof spec.component === "string" && spec.component ? spec.component.slice(0, 40) : "page",
      event: truncate(spec.event, 60),
      renderer: pickRenderer(snapshot()),
    };
    if (typeof spec.op === "string" && spec.op) entry.op = spec.op.slice(0, 64);
    if (typeof spec.parent === "string" && spec.parent) entry.parent = spec.parent.slice(0, 64);
    if (typeof spec.outcome === "string" && spec.outcome) entry.outcome = spec.outcome.slice(0, 20);
    if (typeof spec.durationMs === "number" && Number.isFinite(spec.durationMs)) entry.durationMs = Math.round(spec.durationMs);
    if (spec.error && typeof spec.error === "object") {
      entry.error = {};
      if (typeof spec.error.category === "string" && spec.error.category) entry.error.category = truncate(spec.error.category, 60);
      if (typeof spec.error.message === "string" && spec.error.message) entry.error.message = truncate(spec.error.message, 300);
      if (!Object.keys(entry.error).length) delete entry.error;
    }
    Object.assign(entry, cleanFields(spec.fields));
    events.push(entry);
    if (events.length > EVENT_LIMIT) events = events.slice(-EVENT_LIMIT);
    persist();
    return entry;
  }
  let flushing = false;
  async function flush(reason = "scan", relatedOp) {
    if (flushing || !events.length) return { sent: 0 };
    flushing = true;
    const batch = events.slice(-FLUSH_LIMIT);
    try {
      const response = await send({ sessionId, reason: String(reason).slice(0, 40), op: typeof relatedOp === "string" ? relatedOp.slice(0, 64) : undefined, events: batch });
      if (!response.ok) throw new Error(`Diagnostics endpoint returned HTTP ${response.status}.`);
      const ids = new Set(batch);
      events = events.filter((event) => !ids.has(event));
      persist();
      return { sent: batch.length };
    } catch (error) {
      record({ component: "diagnostics", event: "diagnostics.flush", outcome: "failure", error: { category: "delivery", message: error.message } });
      return { sent: 0, error: error.message };
    } finally { flushing = false; }
  }
  return {
    sessionId,
    record,
    flush,
    events: () => [...events],
    lost: () => lost,
    now: { start: clock() },
  };
}

export function installDiagnostics(diagnostics, target = globalThis) {
  target?.addEventListener?.("error", (event) => {
    const error = event.error || event.reason;
    diagnostics.record({
      component: "page",
      event: "page.error",
      outcome: "failure",
      error: { category: event.reason && !event.error ? "unhandled-rejection" : "exception", message: error?.message || String(event.message || "unknown") },
    });
  });
  target?.addEventListener?.("unhandledrejection", (event) => {
    diagnostics.record({
      component: "page",
      event: "page.error",
      outcome: "failure",
      error: { category: "unhandled-rejection", message: event.reason?.message || String(event.reason || "unknown rejection") },
    });
  });
}
