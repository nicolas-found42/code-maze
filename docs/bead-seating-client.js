export function seatingInput(graph, baseTop) {
  const indices = new Map(graph.rails.map((rail, i) => [rail.id, i]));
  return {
    baseTop,
    rails: graph.rails.map(rail => ({ points: rail.points })),
    nodes: graph.nodes.map(node => ({ position: [node.x, node.y, node.z], tangent: node.tangent, rail: indices.get(node.rail) })),
  };
}

// Maps a seating error to a bounded evidence category. The messages come from
// this module and the scene-side result validation, so the patterns stay in
// one place next to the errors they classify.
export function seatingCategory(error) {
  const message = error?.message || "";
  if (/deadline/i.test(message)) return "timeout";
  if (/result unavailable/i.test(message)) return "message-protocol";
  if (/Invalid toy contact/i.test(message)) return "invalid-result";
  if (/unavailable/i.test(message)) return "worker-unavailable";
  return "error";
}

// Only numeric geometry crosses this worker boundary. A canceled generation
// settles its promise and cannot update the next map, even after a late event.
export function createBeadSeating(WorkerClass = globalThis.Worker, { deadlineMs = 180000 } = {}) {
  let worker, settle, timer;
  function cancel() {
    clearTimeout(timer); timer = undefined;
    const owned = worker; worker = undefined; owned?.terminate();
    settle?.(null); settle = undefined;
  }
  return {
    cancel,
    run(input) {
      cancel();
      if (!input.nodes.length) return Promise.resolve({ positions: [], contacts: [] });
      return new Promise((resolve, reject) => {
        let owned;
        try { owned = new WorkerClass(new URL("./bead-seating-worker.js", import.meta.url), { type: "module" }); }
        catch (error) { reject(error); return; }
        worker = owned; settle = resolve;
        const finish = (result, error) => {
          if (worker !== owned) return;
          clearTimeout(timer); timer = undefined;
          worker = undefined; settle = undefined; owned.terminate();
          if (error) reject(error); else resolve(result);
        };
        owned.onmessage = event => {
          if (event.data?.error) finish(null, new Error(event.data.error));
          else {
            const result = event.data;
            let valid = Array.isArray(result?.positions) && Array.isArray(result?.contacts) &&
              result.positions.length === input.nodes.length && result.contacts.length === input.nodes.length;
            for (let i = 0; valid && i < input.nodes.length; i++) {
              const point = result.positions[i], contact = result.contacts[i];
              valid = Array.isArray(point) && point.length === 3 && [0, 1, 2].every(axis => Number.isFinite(point[axis])) &&
                Number.isFinite(contact?.gap) && contact.gap >= 0 && contact.gap < 0.1 &&
                Number.isFinite(contact.displacement) && contact.displacement >= 0 && contact.displacement <= 4.5;
            }
            if (!valid) {
              finish(null, new Error("Invalid toy contact result"));
            } else finish(result);
          }
        };
        owned.onerror = event => { event.preventDefault?.(); finish(null, new Error("Toy contact worker unavailable")); };
        owned.onmessageerror = () => finish(null, new Error("Toy contact result unavailable"));
        timer = setTimeout(() => finish(null, new Error("Toy contact deadline exceeded")), deadlineMs);
        try { owned.postMessage(input); } catch (error) { finish(null, error); }
      });
    },
  };
}
