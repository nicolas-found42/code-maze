import { createMaze, positionGraph } from "./bead-scene.js";

try { window.THREE = await import("./vendor/three.module.js"); } catch { /* the canvas fallback needs no Three.js */ }

const form = document.getElementById("scan-form");
const pathInput = document.getElementById("repo-path");
const submit = document.getElementById("scan-button");
const status = document.getElementById("status");
const search = document.getElementById("file-search");
const list = document.getElementById("file-list");
const scene = document.getElementById("scene");
let graph;
let selected;
let maze;

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
}
function selectFile(id) {
  const node = graph.nodes.find((item) => item.id === id);
  if (!node) return;
  selected = id;
  maze.select(id);
  document.getElementById("detail-meta").textContent = node.path;
  document.getElementById("detail-body").textContent = `${node.group} · ${node.language} · ${node.lines} lines · ${node.bytes.toLocaleString()} bytes`;
  const connections = document.getElementById("connections");
  connections.replaceChildren();
  for (const [label, edges, key] of [
    ["References", graph.edges.filter((edge) => edge.source === id), "target"],
    ["Referenced by", graph.edges.filter((edge) => edge.target === id), "source"],
  ]) {
    const heading = document.createElement("h3");
    heading.textContent = `${label} (${edges.length})`;
    connections.append(heading, ...edges.map((edge) => fileButton(edge[key])));
  }
  for (const button of list.querySelectorAll("button")) button.setAttribute("aria-pressed", String(button.dataset.file === id));
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
  if (!maze) maze = createMaze(scene, selectFile);
  maze.setGraph(positionGraph(graph));
  maze.setLabels(document.getElementById("show-labels").checked);
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
  document.getElementById("detail-meta").textContent = "Select a bead or file.";
  document.getElementById("detail-body").textContent = "Its incoming and outgoing relationships appear here.";
  document.getElementById("connections").replaceChildren();
  search.value = "";
  renderFiles();
  status.textContent = graph.nodes.length ? `Mapped ${graph.repository.name}.` : "No supported text or source files found in this folder.";
}

async function scan(input) {
  submit.disabled = true;
  pathInput.disabled = true;
  status.textContent = "Scanning local files…";
  status.dataset.state = "loading";
  try {
    const response = await fetch("/api/scan", input === undefined ? { cache: "no-store" } : {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ path: input }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || `Scan returned HTTP ${response.status}.`);
    showGraph(data);
    status.dataset.state = "ready";
  } catch (error) {
    status.textContent = `Scan failed: ${error.message}${graph ? ` Still showing ${graph.repository.name}.` : ""}`;
    status.dataset.state = "error";
  } finally { submit.disabled = false; pathInput.disabled = false; }
}
form.addEventListener("submit", (event) => { event.preventDefault(); scan(pathInput.value); });
search.addEventListener("input", () => { if (graph) renderFiles(); });
document.getElementById("show-labels").addEventListener("change", (event) => maze?.setLabels(event.target.checked));
document.getElementById("reset-view").addEventListener("click", () => maze?.resetView());
if (document.body.dataset.source === "snapshot") {
  pathInput.disabled = true;
  submit.disabled = true;
  try {
    const response = await fetch("./repository-map.json");
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    showGraph(await response.json());
    status.textContent += " Saved snapshot. Run npm start locally to scan another repository.";
  } catch (error) { status.textContent = `Cannot load the saved map: ${error.message}`; status.dataset.state = "error"; }
} else { await scan(); }
