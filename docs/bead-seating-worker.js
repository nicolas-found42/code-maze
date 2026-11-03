import * as THREE from "./vendor/three.module.js";
import { MeshBVH } from "./vendor/contact.js";
import { seatBeads } from "./bead-seating.js";

self.onmessage = event => {
  try { self.postMessage(seatBeads(THREE, MeshBVH, event.data)); }
  catch (error) { self.postMessage({ error: error.message }); }
};
