import { createMaze, positionGraph } from "./bead-scene.js";
import { motion, revealPlayground } from "./playground-motion.js";
import { createDiscoveryGuide } from "./discovery-guide.js";
import { createDiagnostics, installDiagnostics } from "./diagnostics.js";

try { window.THREE = await import("./vendor/three.module.js"); } catch { /* the canvas fallback needs no Three.js */ }

const form = document.getElementById("scan-form");
const pathInput = document.getElementById("repo-path");
const submit = document.getElementById("scan-button");
const status = document.getElementById("status");
const search = document.getElementById("file-search");
const list = document.getElementById("file-list");
const scene = document.getElementById("scene");
const diagnostics = createDiagnostics({ snapshot: () => scene?.dataset ?? {} });
installDiagnostics(diagnostics);
let graph;
let selected;
let maze;
let detailTransition;
const guide = createDiscoveryGuide(selectFile);
revealPlayground();

function fileButton(id) {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = id;
  button.dataset.file = id;
  button.setAttribute("aria-pressed", String(id === selected));
  button.addEventListener("click", () => selectFile(id));
  return button;
}
function renderFiles() {
  const query = search.value.trim().toLowerCase();
  const nodes = graph.nodes.filter((node) => node.id.toLowerCase().includes(query));
  list.replaceChildren(...nodes.map((node) => fileButton(node.id)));
  document.getElementById("file-count").textContent = `${nodes.length} of ${graph.nodes.length} files`;
  document.getElementById("empty-search").hidden = nodes.length > 0 || graph.nodes.length === 0;
}
function selectFile(id, guided = false) {
  const node = graph.nodes.find((item) => item.id === id);
  if (!node) return;
  selected = id;
  if (!guided) guide.onManualSelection();
  maze.select(id);
  document.getElementById("detail-meta").textContent = node.path;
  document.getElementById("detail-body").textContent = `${node.group} · ${node.language} · ${node.lines} lines · ${node.bytes.toLocaleString()} bytes`;
  const connections = document.getElementById("connections");
  connections.replaceChildren();
  const outgoing = graph.edges.filter((edge) => edge.source === id);
  const incoming = graph.edges.filter((edge) => edge.target === id);
  document.getElementById("detail-story").textContent = outgoing.length || incoming.length
    ? `This file uses ${outgoing.length} ${outgoing.length === 1 ? "file" : "files"}. ${incoming.length} ${incoming.length === 1 ? "file uses" : "files use"} this one.`
    : "A solo bead! No references to other files were found. It still belongs in your project.";
  for (const [label, edges, key, explanation] of [
    ["References", outgoing, "target", "Gold arrows → files this one uses"],
    ["Referenced by", incoming, "source", "Blue arrows ← files that use this one"],
  ]) {
    const heading = document.createElement("h3");
    heading.textContent = `${label} (${edges.length})`;
    const note = document.createElement("p");
    note.className = "connection-note";
    note.textContent = edges.length ? explanation : "No references found in this direction.";
    connections.append(heading, note, ...edges.map((edge) => fileButton(edge[key])));
  }
  for (const button of list.querySelectorAll("button")) button.setAttribute("aria-pressed", String(button.dataset.file === id));
  detailTransition?.revert();
  detailTransition = motion.animate(document.getElementById("detail-content"), { x: [8, 0], duration: 350, ease: "out(3)" });
}

function validateGraph(data) {
  if (data?.schemaVersion !== 1 || typeof data.repository?.name !== "string" || !Array.isArray(data.nodes) || !Array.isArray(data.edges) || !Array.isArray(data.groups) || !Array.isArray(data.warnings)) throw new Error("The server returned an invalid map.");
  const groups = new Set(data.groups.map((group) => group.id));
  const ids = new Set(data.nodes.map((node) => node.id));
  if (ids.size !== data.nodes.length || data.nodes.some((node) => typeof node.id !== "string" || !groups.has(node.group)) || data.edges.some((edge) => !ids.has(edge.source) || !ids.has(edge.target))) throw new Error("The map contains invalid file relationships.");
  return data;
}
function showGraph(data) {
  graph = validateGraph(data);
  selected = undefined;
  if (!maze) maze = createMaze(scene, selectFile, (event) => diagnostics.record(event));
  maze.setGraph(positionGraph(graph));
  maze.setLabels(document.getElementById("show-labels").checked);
  const flatView = scene.dataset.renderer === "canvas2d";
  document.querySelector(".scene-sticker").hidden = flatView;
  document.getElementById("reset-view").hidden = flatView;
  document.getElementById("studio-photo").hidden = flatView;
  document.getElementById("scene-help").textContent = flatView ? "Flat view · Tap a bead or choose a file from the list" : "✥ Drag to spin · Scroll to zoom · Pick a bead";
  document.querySelector(".keyboard-hint").textContent = flatView ? "Keyboard: use Tab and Enter to choose a file below" : "Keyboard: arrows spin · + / − zoom · 0 resets";
  pathInput.value = graph.repository.root;
  document.getElementById("repo-name").textContent = graph.repository.name;
  document.getElementById("summary").textContent = `${graph.nodes.length} files · ${graph.edges.length} relationships · ${graph.groups.length} directory groups`;
  const legend = document.getElementById("legend");
  legend.replaceChildren(...graph.groups.map((group) => {
    const item = document.createElement("span");
    const dot = document.createElement("i");
    dot.style.backgroundColor = group.color;
    item.append(dot, group.label);
    return item;
  }));
  const warningList = document.getElementById("warnings");
  warningList.replaceChildren(...graph.warnings.map((warning) => {
    const item = document.createElement("li"); item.textContent = warning; return item;
  }));
  document.getElementById("scan-notes").hidden = !graph.warnings.length;
  document.getElementById("warning-count").textContent = `(${graph.warnings.length} ${graph.warnings.length === 1 ? "note" : "notes"})`;
  document.getElementById("detail-meta").textContent = graph.nodes.length ? "What will you discover?" : "No beads here yet.";
  document.getElementById("detail-body").textContent = graph.nodes.length ? "Tap a bead in the maze or choose a file below. Its story will appear here." : "Try a folder with code, documentation, or configuration files.";
  document.getElementById("detail-story").textContent = "";
  document.getElementById("connections").replaceChildren();
  search.value = "";
  renderFiles();
  guide.setGraph(graph);
  status.textContent = graph.nodes.length ? `Mapped ${graph.repository.name}.` : "No supported text or source files found in this folder.";
}

async function scan(input) {
  submit.disabled = true;
  pathInput.disabled = true;
  status.textContent = "Scanning local files…";
  status.dataset.state = "loading";
  const started = performance.now();
  let operationId;
  try {
    const response = await fetch("/api/scan", input === undefined ? { cache: "no-store" } : {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ path: input }),
    });
    operationId = response.headers.get("x-operation-id") || undefined;
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || `Scan returned HTTP ${response.status}.`);
    showGraph(data);
    status.dataset.state = "ready";
    diagnostics.record({ component: "scan", event: "scan.finish", outcome: "success", op: operationId, durationMs: performance.now() - started });
  } catch (error) {
    status.textContent = `Scan failed: ${error.message}${graph ? ` Still showing ${graph.repository.name}.` : ""}`;
    status.dataset.state = "error";
    diagnostics.record({
      component: "scan", event: "scan.finish", outcome: "failure", op: operationId,
      durationMs: performance.now() - started,
      error: { category: operationId ? "server" : "network", message: error.message },
    });
  } finally { submit.disabled = false; pathInput.disabled = false; diagnostics.flush("scan", operationId); }
}
form.addEventListener("submit", (event) => { event.preventDefault(); scan(pathInput.value); });
search.addEventListener("input", () => { if (graph) renderFiles(); });
document.getElementById("clear-search").addEventListener("click", () => { search.value = ""; renderFiles(); search.focus(); });
document.getElementById("show-labels").addEventListener("change", (event) => maze?.setLabels(event.target.checked));
document.getElementById("reset-view").addEventListener("click", () => maze?.resetView());
if (document.body.dataset.source === "snapshot") {
  pathInput.disabled = true;
  submit.disabled = true;
  try {
    const response = await fetch("./repository-map.json");
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    showGraph(await response.json());
    status.dataset.state = "ready";
    status.textContent += " Saved snapshot. Run npm start locally to scan another repository.";
  } catch (error) {
    status.textContent = `Cannot load the saved map: ${error.message}`;
    status.dataset.state = "error";
    diagnostics.record({ component: "scan", event: "snapshot.load", outcome: "failure", error: { category: "snapshot", message: error.message } });
  }
} else {
  fetch("/api/health", { cache: "no-store" }).then((response) => response.ok ? response.json() : null).then((health) => {
    if (health) diagnostics.record({ component: "diagnostics", event: "server.instance", outcome: "success", fields: { version: health.version, node: health.node, pid: health.pid, startedAt: health.startedAt } });
  }).catch(() => { /* the map works without the health endpoint */ });
  await scan();
}
