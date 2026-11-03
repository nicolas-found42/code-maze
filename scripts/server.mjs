import { createServer } from "node:http";
import { createReadStream } from "node:fs";
import { realpath, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { scanRepository } from "../lib/scan-repository.mjs";

const project = fileURLToPath(new URL("../", import.meta.url));
const MIME = { ".html": "text/html", ".htm": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".json": "application/json", ".css": "text/css", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".svg": "image/svg+xml", ".mp4": "video/mp4", ".md": "text/markdown", ".txt": "text/plain", ".ico": "image/x-icon" };

export function createApp({ repository = project, staticRoot = project } = {}) {
  let scanning = false;
  function json(response, status, data) {
    response.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" });
    response.end(JSON.stringify(data));
  }
  return createServer(async (request, response) => {
    try {
      const expectedHost = `127.0.0.1:${request.socket.localPort}`;
      const host = request.headers.host;
      if (host !== expectedHost && host !== `localhost:${request.socket.localPort}`) return json(response, 403, { error: "Use the local server address." });
      if (request.headers.origin && request.headers.origin !== `http://${host}`) return json(response, 403, { error: "Cross-origin requests are not allowed." });
      const site = request.headers["sec-fetch-site"];
      if (site && site !== "same-origin" && site !== "none") return json(response, 403, { error: "Cross-site requests are not allowed." });
      const url = new URL(request.url, `http://${host}`);
      if (url.pathname === "/api/scan") {
        if (!["GET", "POST"].includes(request.method)) return json(response, 405, { error: "Use GET or POST." });
        if (scanning) return json(response, 409, { error: "A scan is already running. Try again when it finishes." });
        if (request.method === "POST" && request.headers["content-type"]?.split(";")[0].trim().toLowerCase() !== "application/json") return json(response, 415, { error: "Send application/json." });
        let input = repository;
        let maxFiles = 600;
        if (request.method === "POST") {
          let body = "";
          for await (const chunk of request) {
            body += chunk;
            if (Buffer.byteLength(body) > 8192) return json(response, 413, { error: "Request body is too large." });
          }
          let data;
          try { data = JSON.parse(body); } catch { return json(response, 400, { error: "Invalid JSON." }); }
          if (!data || typeof data.path !== "string") return json(response, 400, { error: "Enter a repository path." });
          input = data.path;
          maxFiles = data.maxFiles ?? maxFiles;
        }
        scanning = true;
        try { return json(response, 200, await scanRepository(input, { maxFiles })); }
        catch (error) { return json(response, 400, { error: error.message }); }
        finally { scanning = false; }
      }
      if (!["GET", "HEAD"].includes(request.method)) return json(response, 405, { error: "Use GET or HEAD." });
      if (url.pathname === "/favicon.ico") { response.writeHead(204); return response.end(); }
      const relative = decodeURIComponent(url.pathname).replace(/^\//, "") || "index.html";
      if (relative !== "index.html" && (!relative.startsWith("docs/") || relative.split("/").some((part) => part.startsWith(".")))) return json(response, 404, { error: "Not found." });
      const filename = await realpath(path.resolve(staticRoot, relative));
      const allowedRoot = await realpath(staticRoot);
      if (!filename.startsWith(allowedRoot + path.sep)) return json(response, 404, { error: "Not found." });
      const info = await stat(filename);
      if (!info.isFile()) return json(response, 404, { error: "Not found." });
      response.writeHead(200, { "Content-Type": MIME[path.extname(filename)] || "application/octet-stream", "Content-Length": info.size, "Cache-Control": "no-cache", "X-Content-Type-Options": "nosniff" });
      if (request.method === "HEAD") return response.end();
      createReadStream(filename).on("error", () => response.destroy()).pipe(response);
    } catch (error) {
      json(response, error.code === "ENOENT" ? 404 : 400, { error: error.code === "ENOENT" ? "Not found." : error.message });
    }
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const args = process.argv.slice(2);
  let repository = project;
  let staticRoot = project;
  let port = 3000;
  const fail = (message) => { console.error(`Server failed: ${message}`); process.exit(1); };
  while (args.length) {
    const arg = args.shift();
    if (arg === "--port" && args.length) {
      port = Number(args.shift());
      if (!Number.isInteger(port) || port < 1 || port > 65535) fail("Port must be an integer between 1 and 65535.");
    }
    else if (arg === "--directory" && args.length) staticRoot = path.resolve(args.shift());
    else if (!arg.startsWith("--")) repository = arg;
    else fail(`Unknown or incomplete option: ${arg}`);
  }
  try {
    if (!(await stat(staticRoot)).isDirectory()) fail(`The static directory is not a directory: ${staticRoot}`);
  } catch { fail(`The static directory does not exist: ${staticRoot}`); }
  const app = createApp({ repository, staticRoot });
  app.on("error", (error) => { console.error(`Server failed: ${error.message}`); process.exitCode = 1; });
  app.listen(port, "127.0.0.1", () => console.log(`Code Maze: http://localhost:${app.address().port}\nRepository: ${repository}`));
}
