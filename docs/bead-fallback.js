// A projected view of the same physical tracks used by the WebGL renderer.
export function createCanvasMaze(container, onSelect) {
  const canvas = document.createElement("canvas");
  canvas.setAttribute("aria-label", "Codebase bead maze, canvas view");
  container.replaceChildren(canvas);
  container.dataset.renderer = "canvas2d";
  const context = canvas.getContext("2d");
  let current, selected, names = true, hits = [];
  function draw() {
    if (!current) return;
    const width = container.clientWidth, height = container.clientHeight;
    const ratio = Math.min(devicePixelRatio || 1, 2);
    canvas.width = width * ratio; canvas.height = height * ratio;
    canvas.style.width = `${width}px`; canvas.style.height = `${height}px`;
    context.scale(ratio, ratio);
    context.fillStyle = "#f0e9dd"; context.fillRect(0, 0, width, height);
    const raw = (x, y, z) => [x * 0.88 - z * 0.35, z * 0.38 + x * 0.14 - y * 0.85];
    const corners = [];
    for (const x of [-current.width / 2, current.width / 2]) for (const z of [-current.depth / 2, current.depth / 2]) corners.push(raw(x, 0, z));
    for (const rail of current.rails) corners.push(...rail.points.map((point) => raw(...point)), raw(...rail.labelPosition));
    const minX = Math.min(...corners.map((p) => p[0])), maxX = Math.max(...corners.map((p) => p[0]));
    const minY = Math.min(...corners.map((p) => p[1])) - 40, maxY = Math.max(...corners.map((p) => p[1]));
    const scale = Math.min((width - 28) / (maxX - minX), (height - 50) / (maxY - minY));
    const project = (x, y, z) => { const p = raw(x, y, z); return [width / 2 + (p[0] - (minX + maxX) / 2) * scale, height / 2 + (p[1] - (minY + maxY) / 2) * scale]; };
    const board = [[-1,-1],[1,-1],[1,1],[-1,1]].map(([x,z]) => project(x * current.width / 2, 30, z * current.depth / 2));
    context.beginPath();
    board.forEach(([x,y], i) => i ? context.lineTo(x,y) : context.moveTo(x,y));
    context.closePath(); context.shadowColor = "#72523155"; context.shadowBlur = 18; context.shadowOffsetY = 12;
    context.fillStyle = "#d9b581"; context.fill(); context.shadowColor = "transparent";
    context.lineWidth = 6; context.strokeStyle = "#b98f5e"; context.stroke();
    for (const rail of current.rails) {
      const points = rail.points.map((point) => project(...point));
      context.beginPath(); points.forEach(([x,y], i) => i ? context.lineTo(x,y) : context.moveTo(x,y));
      context.lineCap = "round"; context.strokeStyle = "#382d2355"; context.lineWidth = Math.max(4, 13 * scale); context.stroke();
      context.strokeStyle = rail.color; context.lineWidth = Math.max(3, 10 * scale); context.stroke();
      for (const point of [rail.points[0], rail.points.at(-1)]) {
        const [x,y] = project(...point); context.beginPath(); context.ellipse(x,y, Math.max(5, 15 * scale), Math.max(3, 7 * scale), 0, 0, Math.PI*2);
        context.fillStyle = "#38322b"; context.fill();
      }
      const [x,y] = project(...rail.labelPosition);
      context.font = "600 11px system-ui"; context.textAlign = "center"; context.fillStyle = "#443326"; context.fillText(rail.label, x,y);
    }
    const byId = new Map(current.nodes.map((node) => [node.id, node]));
    for (const edge of current.edges) {
      if (edge.source !== selected && edge.target !== selected) continue;
      const a = byId.get(edge.source), b = byId.get(edge.target);
      const [x0,y0] = project(a.x,a.y,a.z), [x1,y1] = project(b.x,b.y,b.z);
      const [xm,ym] = project((a.x+b.x)/2,Math.max(a.y,b.y)+100,(a.z+b.z)/2);
      context.beginPath(); context.moveTo(x0,y0); context.quadraticCurveTo(xm,ym,x1,y1);
      context.setLineDash([5,4]); context.lineWidth = 2; context.strokeStyle = edge.source === selected ? "#ac5f13" : "#315e94"; context.stroke(); context.setLineDash([]);
    }
    hits = [];
    const occupied = [];
    for (const node of [...current.nodes].sort((a,b) => a.z - b.z)) {
      const [x,y] = project(node.x,node.y,node.z);
      const r = Math.max(6,23*scale);
      context.beginPath(); context.arc(x,y,r,0,Math.PI*2);
      const paint = context.createRadialGradient(x-r*.3,y-r*.4,1,x,y,r);
      paint.addColorStop(0,"#fff4d2"); paint.addColorStop(.35,node.color); paint.addColorStop(1,"#583920");
      context.fillStyle = paint; context.fill();
      context.beginPath(); context.arc(x,y,Math.max(1,r*.2),0,Math.PI*2); context.fillStyle = "#453122"; context.fill();
      if (node.id === selected) {
        context.beginPath(); context.arc(x,y,r+5,0,Math.PI*2); context.lineWidth = 3; context.strokeStyle = "#d3920e"; context.stroke();
      }
      const labelWidth = context.measureText(node.label).width;
      if ((names && !occupied.some((p) => Math.abs(x-p.x)<(labelWidth+p.width)/2+6 && Math.abs(y-p.y)<25)) || node.id === selected) {
        context.font = "11px system-ui"; context.textAlign = "center";
        context.fillStyle = node.id === selected ? "#352517" : "#fffaf0"; context.fillRect(x-labelWidth/2-5,y-r-23,labelWidth+10,18);
        context.fillStyle = node.id === selected ? "#fffaf0" : "#352517"; context.fillText(node.label,x,y-r-10);
        occupied.push({x,y,width:labelWidth});
      }
      hits.push({id:node.id,x,y,radius:r});
    }
  }
  function hitAt(event) {
    const bounds=canvas.getBoundingClientRect();
    return [...hits].reverse().find((item)=>Math.hypot(event.clientX-bounds.left-item.x,event.clientY-bounds.top-item.y)<item.radius+4);
  }
  canvas.addEventListener("click",(event)=>{ const hit=hitAt(event); if(hit) onSelect(hit.id); });
  canvas.addEventListener("pointermove",(event)=>{ const hit=hitAt(event); canvas.title=hit?.id||""; canvas.style.cursor=hit?"pointer":"default"; });
  new ResizeObserver(draw).observe(container);
  return {
    setGraph(graph) { current=graph; selected=null; container.dataset.nodes=String(graph.nodes.length); container.dataset.edges=String(graph.edges.length); container.dataset.tracks=String(graph.rails.length); draw(); },
    select(id) { selected=id; container.dataset.selected=id||""; draw(); },
    setLabels(value) { names=value; draw(); },
    resetView() { draw(); },
  };
}
