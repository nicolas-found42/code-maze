// The network sees only the generated linear HDR light buffer. No source photo
// or generative reconstruction enters the render. Every session owns its device.
async function openNetwork(signal) {
  if (!navigator.gpu) throw new Error("WebGPU is unavailable");
  const [{ initUNetFromBuffer }, response, adapter] = await Promise.all([
    import("./vendor/oidn.js"),
    fetch(new URL("./vendor/oidn-rt_hdr_alb_nrm.tza", import.meta.url), { signal }),
    navigator.gpu?.requestAdapter({ powerPreference: "high-performance" }),
  ]);
  if (signal.aborted) throw signal.reason;
  if (!adapter || !response.ok) throw new Error("Neural photo refinement unavailable");
  const buffer = await response.arrayBuffer();
  const requiredLimits = Object.fromEntries(["maxComputeWorkgroupStorageSize", "maxComputeWorkgroupsPerDimension", "maxStorageBufferBindingSize", "maxBufferSize", "maxComputeWorkgroupSizeX", "maxComputeInvocationsPerWorkgroup"].map(key => [key, adapter.limits[key]]));
  const device = await adapter.requestDevice({ requiredFeatures: adapter.features.has("shader-f16") ? ["shader-f16"] : [], requiredLimits });
  const destroy = () => device.destroy();
  signal.addEventListener("abort", destroy, { once: true });
  if (signal.aborted) { destroy(); throw signal.reason; }
  try {
    const network = await initUNetFromBuffer(buffer, { device }, { hdr: true, aux: true, maxTileSize: 256, dynamicTile: false, engine: "wgsl" });
    if (signal.aborted) { network.dispose(); throw signal.reason; }
    return {
      execute(image, done, error) { return network.tileExecute({ ...image, scheduling: "animation-frame", done, error }); },
      dispose() { signal.removeEventListener("abort", destroy); network.dispose(); destroy(); },
    };
  } catch (error) {
    signal.removeEventListener("abort", destroy); destroy(); throw error;
  }
}

export function createPhotoDenoising(load = openNetwork) {
  let generation = 0, disposed = false, loading, network, abort, settle, timer;
  const lifetime = new AbortController();
  function cancel() {
    generation++;
    clearTimeout(timer); timer = undefined;
    abort?.(); abort = undefined;
    settle?.(null); settle = undefined;
  }
  return {
    cancel,
    run(image) {
      cancel();
      if (disposed) return Promise.resolve(null);
      const request = generation;
      return new Promise((resolve) => {
        settle = resolve;
        const finish = (output) => {
          if (request !== generation || disposed) return;
          clearTimeout(timer); timer = undefined;
          settle = undefined; abort = undefined;
          resolve(output);
        };
        timer = setTimeout(() => { cancel(); lifetime.abort(new Error("Photo refinement deadline")); }, 30000);
        loading ??= load(lifetime.signal).then((value) => {
          if (disposed) { value.dispose(); return null; }
          network = value;
          return value;
        });
        loading.then((value) => {
          if (!value || request !== generation || disposed) return;
          abort = value.execute(image, finish, () => finish(null));
        }).catch(() => finish(null));
      });
    },
    dispose() {
      disposed = true; cancel(); lifetime.abort();
      network?.dispose(); network = undefined;
    },
  };
}

// WebGL readback is bottom-up; OIDN's CPU image contract is top row first.
export function readLinearImage(renderer, target, { ArrayType = Float32Array, decode = value => value } = {}) {
  const { width, height } = target;
  const bottomUp = new ArrayType(width * height * 4);
  renderer.readRenderTargetPixels(target, 0, 0, width, height, bottomUp);
  const data = new Float32Array(bottomUp.length);
  const stride = width * 4;
  for (let row = 0; row < height; row++) {
    const input = bottomUp.subarray((height - row - 1) * stride, (height - row) * stride);
    const offset = row * stride;
    for (let i = 0; i < stride; i++) {
      const value = decode(input[i]);
      data[offset + i] = Number.isFinite(value) ? Math.max(0, value) : 0;
    }
  }
  return { data, width, height };
}
