// Optional effects never prevent the map from working if an effect asset fails to load.
const [anime, confettiModule] = await Promise.all([
  import("./vendor/anime.esm.min.js").catch(() => null),
  import("./vendor/confetti.module.mjs").catch(() => null),
]);
const preference = matchMedia("(prefers-reduced-motion: reduce)");
const toggle = document.getElementById("motion-toggle");
const active = new Set();
const listeners = new Set();
let userEnabled = true;
try { userEnabled = localStorage.getItem("code-maze-motion") !== "off"; } catch { /* storage may be unavailable */ }

export const motion = {
  get enabled() { return userEnabled && !preference.matches; },
  get canAnimate() { return this.enabled && Boolean(anime); },
  animate(target, options) {
    if (!this.canAnimate) return;
    let animation;
    animation = anime.animate(target, {
      ...options,
      onComplete: (...args) => {
        active.delete(animation);
        options.onComplete?.(...args);
      },
    });
    active.add(animation);
    return { revert() { active.delete(animation); animation.revert(); } };
  },
  subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
  celebrate() {
    if (this.enabled) confettiModule?.default({ particleCount: 65, spread: 65, startVelocity: 28, ticks: 130, origin: { x: .7, y: .65 }, colors: ["#b59be9", "#c8f36b", "#ff927b", "#68b5dd"], disableForReducedMotion: true });
  },
};
function sync() {
  if (!motion.enabled) {
    for (const animation of active) animation.revert();
    active.clear();
    confettiModule?.default.reset();
  }
  document.body.dataset.motion = motion.enabled ? "on" : "off";
  toggle.setAttribute("aria-pressed", String(motion.enabled));
  toggle.textContent = motion.enabled ? "Motion on" : "Motion off";
  toggle.disabled = preference.matches;
  toggle.title = preference.matches ? "Motion is off because your device requests reduced motion." : "Turn playful animations on or off";
  for (const listener of listeners) listener(motion.enabled);
}
toggle.addEventListener("click", () => {
  userEnabled = !userEnabled;
  try { localStorage.setItem("code-maze-motion", userEnabled ? "on" : "off"); } catch { /* preference still applies for this page */ }
  sync();
});
preference.addEventListener("change", sync);
sync();

export function revealPlayground() {
  for (const [index, element] of [...document.querySelectorAll(".hero > div, .explain-card, .scan-bar, .stage, .guide-card")].entries()) {
    motion.animate(element, { y: [16, 0], duration: 650, delay: Math.min(index * 55, 330), ease: "out(3)" });
  }
  document.querySelectorAll(".art-bead").forEach((element, index) => {
    motion.animate(element, { y: [-16, 0], duration: 900, delay: index * 120, ease: "outElastic(1, .6)" });
  });
}
