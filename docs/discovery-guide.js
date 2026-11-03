import { motion } from "./playground-motion.js";

export function createDiscoveryGuide(selectFile) {
  const button = document.getElementById("guide-next");
  const heading = document.getElementById("guide-heading");
  const body = document.getElementById("guide-body");
  const stepLabel = document.getElementById("guide-step");
  const progress = [...document.querySelectorAll(".guide-progress span")];
  const mobileTour = document.getElementById("mobile-tour");
  const mobileNext = document.getElementById("mobile-tour-next");
  let graph, edge, step = 0, transition;
  const basename = (id) => id.split("/").at(-1);
  function render() {
    let title, text, action;
    if (!graph.nodes.length) {
      title = "An empty playground.";
      text = "This folder has no supported files yet. Try a project folder with code or text files.";
      action = "Waiting for files";
    } else if (!edge) {
      title = "Every bead has a place.";
      text = "No file references were found in this map. You can still pick a bead and explore its folder, type, and size.";
      action = "Explore a bead";
    } else if (step === 0) {
      title = "Let’s connect the dots.";
      text = "I’ll help you find a file, spot what it uses, and follow the connection.";
      action = "Show me how";
    } else if (step === 1) {
      title = "Meet a little building block.";
      text = `The glowing bead is ${basename(edge.source)}. It’s one file in your project. Its colored track groups it with files in the same folder.`;
      action = "Spot its connection";
    } else if (step === 2) {
      title = "See that gold arrow?";
      text = `${basename(edge.source)} uses ${basename(edge.target)}. The gold arrow points from the file doing the using to the file it uses. Let’s follow it!`;
      action = "Follow the arrow";
    } else {
      title = "Aha! You made a connection.";
      text = edge.source === edge.target ? `This file refers to itself! References can loop back to the same bead. Keep exploring to find more connections.` : `You reached ${basename(edge.target)}. Its blue arrow shows that ${basename(edge.source)} uses it. Same connection, seen from the other side!`;
      action = "Explore again";
    }
    transition?.revert();
    heading.textContent = title;
    body.textContent = text;
    stepLabel.textContent = edge && step ? `Discovery ${step} of 3${step === 3 ? " · complete!" : ""}` : edge ? "A tiny adventure, in 3 steps" : "There’s something to explore in every map";
    button.replaceChildren(document.createTextNode(action));
    const arrow = document.createElement("span"); arrow.textContent = "→"; arrow.setAttribute("aria-hidden", "true"); button.append(arrow);
    button.disabled = !graph.nodes.length;
    progress.forEach((element, index) => element.classList.toggle("is-done", Boolean(edge) && index < step));
    document.querySelector(".guide-card").dataset.step = String(step);
    mobileTour.hidden = !edge || step === 0;
    document.getElementById("mobile-tour-heading").textContent = `${step} / 3 · ${title}`;
    document.getElementById("mobile-tour-body").textContent = text;
    mobileNext.textContent = action;
    transition = motion.animate(document.getElementById("guide-copy"), { y: [5, 0], duration: 320, ease: "out(3)" });
  }
  button.addEventListener("click", () => {
    if (!graph?.nodes.length) return;
    if (!edge) { selectFile(graph.nodes[0].id, true); return; }
    step = step === 3 ? 1 : step + 1;
    selectFile(step === 3 ? edge.target : edge.source, true);
    render();
    if (step === 3) motion.celebrate();
    if (matchMedia("(max-width: 850px)").matches) {
      document.querySelector(".stage").scrollIntoView({ block: "start", behavior: "instant" });
      mobileNext.focus({ preventScroll: true });
    }
  });
  mobileNext.addEventListener("click", () => button.click());
  document.getElementById("end-tour").addEventListener("click", () => {
    step = 0; render();
    // Keep keyboard focus on a visible control after dismissing the mobile tour.
    const canvas = document.querySelector("#scene canvas");
    (canvas?.tabIndex === 0 ? canvas : document.getElementById("file-search")).focus();
  });
  return {
    setGraph(next) {
      graph = next;
      const pairs = new Set(graph.edges.map((item) => JSON.stringify([item.source, item.target])));
      edge = graph.edges.find((item) => item.source !== item.target && !pairs.has(JSON.stringify([item.target, item.source]))) || graph.edges.find((item) => item.source !== item.target) || graph.edges[0];
      step = 0; render();
    },
    onManualSelection() { if (step === 1 || step === 2) { step = 0; render(); } },
  };
}
