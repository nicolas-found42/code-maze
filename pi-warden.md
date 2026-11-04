# No hardcoded secrets

Source code must not contain passwords, API keys, tokens, or connection URLs with credentials.
Read them from the environment, a function parameter, or the config module.

# Comments explain why, not what

A comment states a reason, a constraint, a workaround, or a non-obvious invariant. A comment
that restates what the next line plainly does is a violation.

# Errors are not swallowed

A `catch` block must handle the error, report it, or re-raise it. An empty catch block, or
one whose body is only a comment, is a violation.

# No partial implementations

Implement features fully. A comment that says "for now", "simplified", or "later", or a
stub body, is a violation. If a part genuinely cannot be done, say so in your reply instead
of stubbing it.

# Do not run destructive commands that erase uncommitted work

A changed file must not wire in a command that discards untracked or uncommitted changes. The violation pattern is one of `git reset --hard`, `git checkout -- .`, `git restore .`, `git clean -fd`, or a similar discarding `git clean`/`git checkout`/`git restore` invocation, appearing as a shell script line, an npm script value, or an argument to `child_process`/`exec`/`spawn`. To get a clean tree, create a worktree instead or ask the user.

# No explicit any

paths: **/*.ts, **/*.tsx

A TypeScript file must not use the explicit `any` type. The violation shapes are `: any`, `as any`, `<any>`, `Array<any>`, `any[]`, and `, any>` in generic argument lists such as `Record<string, any>`. Use a concrete type, a union, or `unknown` narrowed at the use site.

# Exported functions declare their return type

paths: src/**/*.ts

Every exported function annotates its return type. Violation shapes: `export function f(a) {` with no `: T` between the parameter list and the opening brace; `export const f = (a) =>` or `export const f = function (a) {` with no `: T` before the arrow or brace; the same shapes under `export default`. A missing annotation is a violation even when the type is inferrable or `void`.

# Browser modules live in docs/, Node tooling in scripts/ and lib/

source: AGENTS.md:5

`lib/scan-repository.mjs` discovers files and references. `scripts/` holds the Node-side server, snapshot CLI, build tooling, asset generators, and browser checks. The active browser implementation (`codebase-map.js`, `bead-layout.js`, `bead-scene.js`, geometry/material/photography modules) lives in `docs/`, with third-party bundles in `docs/vendor/`. Tests live in `test/`. A new browser module placed outside `docs/`, or Node tooling placed in `docs/` outside `docs/vendor/`, is a violation.

# No imports from legacy build code

source: AGENTS.md:7

`_site/` and `scripts/build-pages.mjs` are legacy reference material; build with `npm run build` instead. An `import`, `export ... from`, or `require(` specifier containing `_site/` or `build-pages.mjs` in a changed source file is a violation.

# Use ES modules, not CommonJS

source: AGENTS.md:24

Project source uses ES module syntax; `.mjs` is for Node modules and `.js` for browser modules. In a changed source file, a `require(`, `module.exports`, or `exports.name =` occurrence is a violation; use `import`/`export`.

# Follow the naming conventions

source: AGENTS.md:24

Filenames are kebab-case (`scan-repository.mjs`), functions and variables are camelCase, and constants are uppercase where appropriate (`MAX_BEADS`). A `PascalCase` filename for a plain module, a `snake_case` function name, or a lowercase identifier used as a fixed constant is a violation.

# Tests use node:test and node:assert/strict

source: AGENTS.md:28

Tests live in `test/*.test.mjs` and use `node:test` with `node:assert/strict`, named for the behavior they check. A test file importing `jest`, `vitest`, `mocha`, or `chai`, using `expect(`, a test file outside `test/`, or a behavior-free name like `test("works")` is a violation.

# No changes to generated output or scratch captures

source: AGENTS.md:34

`dist/` is generated output and `.scratch/` holds verification captures. A changed file whose path is under `dist/` or `.scratch/` is a violation; edit the sources and rebuild instead.

# Bundled code assets keep their license notices

source: AGENTS.md:34
paths: docs/vendor/three.module.js, docs/vendor/anime.esm.min.js, docs/vendor/fidelity.js, docs/vendor/pathtracer.js, docs/vendor/*.LICENSE*

These bundles carry their third-party license notice inline: `three.module.js` and `anime.esm.min.js` in an `@license`/`@copyright` header, `fidelity.js` in a `/*!` bundled-license block, `pathtracer.js` in a `// Copyright` comment. A changed file that no longer contains its marker is a violation. `oidn.js`, `contact.js`, `bead-block.js`, `OrbitControls.js`, and `confetti.module.mjs` carry no inline notice — the sibling `*.LICENSE` file is their notice — and are exempt. A changed `*.LICENSE` file must still contain license text.
