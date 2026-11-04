import { createServer } from "node:http";
import { createReadStream, readFileSync } from "node:fs";
import { realpath, stat } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { scanRepository, classifyScanError } from "../lib/scan-repository.mjs";
import { createEvidenceLog, redactPath } from "../lib/evidence.mjs";

const project = fileURLToPath(new URL("../", import.meta.url));
const VERSION = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;
const MIME = { ".html": "text/html", ".htm": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".json": "application/json", ".css": "text/css", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".svg": "image/svg+xml", ".mp4": "video/mp4", ".md": "text/markdown", ".txt": "text/plain", ".ico": "image/x-icon" };
const bootTime = Date.now();
const DIAGNOSTIC_MAX_BYTES = 32768;
const DIAGNOSTIC_MAX_EVENTS = 40;
const COMPONENTS = new Set(["scan", "seating", "photo", "renderer", "page", "diagnostics", "storage"]);
const OUTCOMES = new Set(["success", "failure", "fallback", "canceled", "superseded", "timeout", "rejected"]);
const RENDERER_KEYS = new Set(["renderer", "shading", "support", "photo", "photoDenoising", "photoSamples", "photoFinish", "denoising", "selected", "nodes"]);
const GUARD_CATEGORIES = { 400: "bad-request", 403: "forbidden", 404: "not-found", 405: "method-not-allowed", 409: "already-running", 413: "body-too-large", 415: "media-type" };

function normalizeClientEvent(value) {
  if (!value || typeof value !== "object") return undefined;
  const event = typeof value.event === "string" ? value.event.slice(0, 60) : "";
  if (!event) return undefined;
  const stored = {
    component: COMPONENTS.has(value.component) ? value.component : "page",
    event,
    op: typeof value.op === "string" ? value.op.slice(0, 64) : undefined,
    parent: typeof value.parent === "string" ? value.parent.slice(0, 64) : undefined,
    outcome: OUTCOMES.has(value.outcome) ? value.outcome : undefined,
    durationMs: Number.isFinite(value.durationMs) ? Math.round(value.durationMs) : undefined,
    clientTs: typeof value.ts === "string" && !Number.isNaN(Date.parse(value.ts)) ? value.ts : undefined,
  };
  for (const key of Object.keys(stored)) if (stored[key] === undefined) delete stored[key];
  if (value.error && typeof value.error === "object") {
    stored.error = {};
    if (typeof value.error.category === "string" && value.error.category) stored.error.category = value.error.category.slice(0, 60);
    if (typeof value.error.message === "string" && value.error.message) stored.error.message = value.error.message.slice(0, 300);
    if (!Object.keys(stored.error).length) delete stored.error;
  }
  if (value.renderer && typeof value.renderer === "object") {
    stored.renderer = {};
    for (const [key, item] of Object.entries(value.renderer)) if (RENDERER_KEYS.has(key) && typeof item === "string") stored.renderer[key] = item.slice(0, 40);
    if (!Object.keys(stored.renderer).length) delete stored.renderer;
  }
  return stored;
}

export function createApp({ repository = project, staticRoot = project, evidence } = {}) {
  const log = evidence && typeof evidence.emit === "function" ? evidence : undefined;
  const emit = (event, fields) => { if (log) log.emit(event, fields); };
  let scanning = false;
  function json(response, status, data, headers) {
    response.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store", ...headers });
    response.end(JSON.stringify(data));
  }
  return createServer(async (request, response) => {
    const started = performance.now();
    const op = randomUUID();
    const correlation = { "x-operation-id": op, "x-app-version": VERSION };
    response.once("finish", () => {
      const status = response.statusCode;
      emit("http.request", {
        op,
        outcome: status < 400 ? "success" : "failure",
        durationMs: Math.round(performance.now() - started),
        method: request.method,
        route: request.url ? new URL(request.url, "http://localhost").pathname.slice(0, 120) : "",
        status,
        error: status >= 400 ? { category: GUARD_CATEGORIES[status] || "error" } : undefined,
      });
    });
    try {
      const expectedHost = `127.0.0.1:${request.socket.localPort}`;
      const host = request.headers.host;
      if (host !== expectedHost && host !== `localhost:${request.socket.localPort}`) return json(response, 403, { error: "Use the local server address." }, correlation);
      if (request.headers.origin && request.headers.origin !== `http://${host}`) return json(response, 403, { error: "Cross-origin requests are not allowed." }, correlation);
      const site = request.headers["sec-fetch-site"];
      if (site && site !== "same-origin" && site !== "none") return json(response, 403, { error: "Cross-site requests are not allowed." }, correlation);
      const url = new URL(request.url, `http://${host}`);
      if (url.pathname === "/api/scan") {
        if (!["GET", "POST"].includes(request.method)) return json(response, 405, { error: "Use GET or POST." }, correlation);
        if (scanning) return json(response, 409, { error: "A scan is already running. Try again when it finishes." }, correlation);
        if (request.method === "POST" && request.headers["content-type"]?.split(";")[0].trim().toLowerCase() !== "application/json") return json(response, 415, { error: "Send application/json." }, correlation);
        let input = repository;
        let maxFiles = 600;
        if (request.method === "POST") {
          let body = "";
          for await (const chunk of request) {
            body += chunk;
            if (Buffer.byteLength(body) > 8192) return json(response, 413, { error: "Request body is too large." }, correlation);
          }
          let data;
          try { data = JSON.parse(body); } catch { return json(response, 400, { error: "Invalid JSON." }, correlation); }
          if (!data || typeof data.path !== "string") return json(response, 400, { error: "Enter a repository path." }, correlation);
          input = data.path;
          maxFiles = data.maxFiles ?? maxFiles;
        }
        const scanStarted = performance.now();
        const scanContext = { parent: op, mode: request.method, root: redactPath(String(input).slice(0, 400)), maxFiles };
        emit("scan.start", { op, ...scanContext });
        scanning = true;
        try {
          const graph = await scanRepository(input, { maxFiles });
          const fields = {
            ...scanContext,
            outcome: "success",
            durationMs: Math.round(performance.now() - scanStarted),
            nodes: graph.nodes.length,
            edges: graph.edges.length,
            groups: graph.groups.length,
            warnings: graph.warnings.length,
            generatedAt: graph.generatedAt,
          };
          emit("scan.finish", { op, ...fields });
          return json(response, 200, graph, correlation);
        } catch (error) {
          emit("scan.finish", {
            op,
            ...scanContext,
            outcome: "failure",
            durationMs: Math.round(performance.now() - scanStarted),
            error: { category: classifyScanError(error), message: error.message },
          });
          return json(response, 400, { error: error.message }, correlation);
        } finally { scanning = false; }
      }
      if (url.pathname === "/api/diagnostics") {
        if (request.method !== "POST") return json(response, 405, { error: "Use POST." }, correlation);
        if (request.headers["content-type"]?.split(";")[0].trim().toLowerCase() !== "application/json") return json(response, 415, { error: "Send application/json." }, correlation);
        let body = "";
        for await (const chunk of request) {
          body += chunk;
          if (Buffer.byteLength(body) > DIAGNOSTIC_MAX_BYTES) return json(response, 413, { error: "Request body is too large." }, correlation);
        }
        let data;
        try { data = JSON.parse(body); } catch { return json(response, 400, { error: "Invalid JSON." }, correlation); }
        const incoming = Array.isArray(data?.events) ? data.events : [];
        const normalized = incoming.map(normalizeClientEvent).filter(Boolean).slice(0, DIAGNOSTIC_MAX_EVENTS);
        const dropped = incoming.length - normalized.length;
        const sessionId = typeof data?.sessionId === "string" ? data.sessionId.slice(0, 100) : undefined;
        const appVersion = typeof data?.appVersion === "string" ? data.appVersion.slice(0, 40) : undefined;
        const relatedOp = typeof data?.op === "string" ? data.op.slice(0, 64) : undefined;
        emit("client.report", {
          parent: relatedOp,
          outcome: "success",
          sessionId,
          appVersion,
          received: incoming.length,
          stored: normalized.length,
          dropped,
          userAgent: (request.headers["user-agent"] || "").slice(0, 200),
        });
        for (const item of normalized) {
          emit(item.event, {
            op: item.op,
            parent: item.parent || relatedOp || op,
            component: item.component,
            outcome: item.outcome,
            durationMs: item.durationMs,
            clientTs: item.clientTs,
            error: item.error,
            renderer: item.renderer,
            sessionId,
          });
        }
        return json(response, 200, { stored: normalized.length, dropped }, correlation);
      }
      if (url.pathname === "/api/health") {
        if (request.method !== "GET") return json(response, 405, { error: "Use GET." }, correlation);
        return json(response, 200, {
          version: VERSION,
          node: process.version,
          pid: process.pid,
          startedAt: new Date(bootTime).toISOString(),
          uptimeSeconds: Math.round((Date.now() - bootTime) / 1000),
          evidence: log ? log.stats() : null,
        }, correlation);
      }
      if (!["GET", "HEAD"].includes(request.method)) return json(response, 405, { error: "Use GET or HEAD." }, correlation);
      if (url.pathname === "/favicon.ico") { response.writeHead(204, correlation); return response.end(); }
      const relative = decodeURIComponent(url.pathname).replace(/^\//, "") || "index.html";
      if (relative !== "index.html" && (!relative.startsWith("docs/") || relative.split("/").some((part) => part.startsWith(".")))) return json(response, 404, { error: "Not found." }, correlation);
      const filename = await realpath(path.resolve(staticRoot, relative));
      const allowedRoot = await realpath(staticRoot);
      if (!filename.startsWith(allowedRoot + path.sep)) return json(response, 404, { error: "Not found." }, correlation);
      const info = await stat(filename);
      if (!info.isFile()) return json(response, 404, { error: "Not found." }, correlation);
      response.writeHead(200, { "Content-Type": MIME[path.extname(filename)] || "application/octet-stream", "Content-Length": info.size, "Cache-Control": "no-cache", "X-Content-Type-Options": "nosniff", ...correlation });
      if (request.method === "HEAD") return response.end();
      createReadStream(filename).on("error", () => { emit("static.read-failure", { parent: op, outcome: "failure", file: redactPath(filename).slice(0, 200) }); response.destroy(); }).pipe(response);
    } catch (error) {
      json(response, error.code === "ENOENT" ? 404 : 400, { error: error.code === "ENOENT" ? "Not found." : error.message }, correlation);
    }
  });
}

function parsePort(value, fail) {
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) fail("Port must be an integer between 1 and 65535.");
  return port;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const args = process.argv.slice(2);
  let repository = project;
  let staticRoot = project;
  let port = 3000;
  const fail = (message) => { console.error(`Server failed: ${message}`); process.exit(1); };
  while (args.length) {
    const arg = args.shift();
    if (arg === "--port" && args.length) port = parsePort(args.shift(), fail);
    else if (arg === "--directory" && args.length) staticRoot = path.resolve(args.shift());
    else if (!arg.startsWith("--")) repository = arg;
    else fail(`Unknown or incomplete option: ${arg}`);
  }
  try {
    if (!(await stat(staticRoot)).isDirectory()) fail(`The static directory is not a directory: ${staticRoot}`);
  } catch { fail(`The static directory does not exist: ${staticRoot}`); }
  const evidenceDir = process.env.CODE_MAZE_EVIDENCE_DIR || path.join(project, ".evidence");
  const evidence = createEvidenceLog({
    dir: evidenceDir,
    component: "server",
    onWriteFailure: (error) => console.error(`Evidence store write failed (${evidenceDir}): ${error.message}`),
  });
  evidence.emit("server.start", {
    version: VERSION,
    node: process.version,
    platform: process.platform,
    arch: process.arch,
    pid: process.pid,
    port,
    repository: redactPath(path.resolve(repository)),
    staticRoot: redactPath(staticRoot),
    evidenceDir: redactPath(evidenceDir),
  });
  const app = createApp({ repository, staticRoot, evidence });
  app.on("error", (error) => { console.error(`Server failed: ${error.message}`); process.exitCode = 1; });
  const stop = async (signal) => {
    evidence.emit("server.stop", { outcome: "success", signal, pid: process.pid, uptimeSeconds: Math.round((Date.now() - bootTime) / 1000) });
    await evidence.close();
    process.exit(0);
  };
  process.on("SIGINT", () => { void stop("SIGINT"); });
  process.on("SIGTERM", () => { void stop("SIGTERM"); });
  app.listen(port, "127.0.0.1", () => console.log(`Code Maze: http://localhost:${app.address().port}\nRepository: ${repository}\nEvidence: ${evidenceDir}`));
}
