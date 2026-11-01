import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { scanRepository } from "../lib/scan-repository.mjs";

async function fixture(t, files) {
  const root = await mkdtemp(path.join(os.tmpdir(), "code-maze-test-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  for (const [id, text] of Object.entries(files)) {
    await mkdir(path.dirname(path.join(root, id)), { recursive: true });
    await writeFile(path.join(root, id), text);
  }
  return root;
}
const pairs = (graph) => graph.edges.map((edge) => `${edge.source} -> ${edge.target}`).sort();

test("resolves JS/TS imports, exports, require, dynamic literals, aliases, and .js imports of TS sources", async (t) => {
  const root = await fixture(t, {
    "tsconfig.json": JSON.stringify({ compilerOptions: { baseUrl: ".", paths: { "@/*": ["src/*"] } } }),
    "src/main.ts": `import { value } from './util.js';
      export * from '@/util';
      const lazy = import('./lazy');
      const common = require('./common.cjs');
      import type { Shape } from './types';
      import 'external-package';
      import './missing';
      // import './comment-only';
      const text = "import './string-only'";
      import(variable);`,
    "src/util.ts": "export const value = 1;",
    "src/lazy/index.ts": "export default 1;",
    "src/common.cjs": "module.exports = 1;",
    "src/types.ts": "export type Shape = string;",
    "src/comment-only.ts": "",
    "src/string-only.ts": "",
  });
  const graph = await scanRepository(root);
  assert.deepEqual(pairs(graph), ["src/main.ts -> src/common.cjs", "src/main.ts -> src/lazy/index.ts", "src/main.ts -> src/types.ts", "src/main.ts -> src/util.ts"]);
  assert.equal(graph.stats.unresolvedReferences, 1);
  assert.equal(graph.nodes.find((node) => node.id === "src/util.ts").bytes, 23);
  assert.ok(!JSON.stringify(graph).includes("export const value"), "source content stays out of the graph");
});

test("respects nested ignore rules, skips generated files, binary files, hidden paths, and symlinks", async (t) => {
  const root = await fixture(t, {
    ".gitignore": "*.generated.js\nignored/\n",
    "src/.gitignore": "!keep.generated.js\n",
    "src/keep.generated.js": "export {};",
    "src/drop.generated.js": "export {};",
    "src/main.js": "",
    "ignored/file.js": "",
    "node_modules/package/main.js": "",
    "dist/main.js": "",
    ".git/config": "",
    ".env": "secret",
    "binary.txt": Buffer.from([0, 1, 2]),
    "repository-map.json": "{}",
    "large.txt": "a".repeat(200),
  });
  await symlink(path.join(root, "src"), path.join(root, "linked"));
  const graph = await scanRepository(root, { maxFileBytes: 100 });
  assert.deepEqual(graph.nodes.map((node) => node.id), ["src/keep.generated.js", "src/main.js"]);
  assert.equal(graph.stats.omittedFiles, 2);
  assert.ok(graph.warnings.length);
});

test("extracts local HTML/CSS, Python, C includes, and Rust module relationships", async (t) => {
  const root = await fixture(t, {
    "index.html": `<script src="./src/main.js"></script><link href="./style.css" rel="stylesheet"><script type="module">import './src/inline.js';</script>`,
    "src/main.js": "",
    "src/inline.js": "",
    "style.css": `/* @import './ignored.css'; */ @import './base.css';`,
    "base.css": "",
    "pkg/__init__.py": "",
    "pkg/main.py": "from . import helper\nfrom pkg.helper import value\nimport os\n",
    "pkg/helper.py": "value = 1\n",
    "native/main.cpp": '#include "local.h"\n#include <vector>\n',
    "native/local.h": "",
    "rust/src/lib.rs": "pub mod data; // mod missing;",
    "rust/src/data.rs": "mod inner;",
    "rust/src/data/inner.rs": "",
  });
  const graph = await scanRepository(root);
  assert.deepEqual(pairs(graph), [
    "index.html -> src/inline.js", "index.html -> src/main.js", "index.html -> style.css",
    "native/main.cpp -> native/local.h", "pkg/main.py -> pkg/__init__.py", "pkg/main.py -> pkg/helper.py",
    "rust/src/data.rs -> rust/src/data/inner.rs", "rust/src/lib.rs -> rust/src/data.rs", "style.css -> base.css",
  ]);
});

test("file limits are explicit, scans are deterministic, empty directories and cycles are valid", async (t) => {
  const root = await fixture(t, { "a.js": "import './b.js';", "b.js": "import './a.js';", "c.md": "docs" });
  const first = await scanRepository(root);
  const second = await scanRepository(root);
  assert.deepEqual(first.nodes, second.nodes);
  assert.equal(first.edges.length, 2);
  const limited = await scanRepository(root, { maxFiles: 1 });
  assert.equal(limited.nodes.length, 1);
  assert.equal(limited.edges.length, 0);
  assert.equal(limited.stats.omittedFiles, 2);
  assert.ok(limited.warnings[0].includes("omitted"));
  const empty = await fixture(t, {});
  assert.equal((await scanRepository(empty)).nodes.length, 0);
  await assert.rejects(scanRepository(root, { maxFiles: 0 }), /maxFiles/);
  await assert.rejects(scanRepository(path.join(root, "missing")), /ENOENT/);
});
