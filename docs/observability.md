# Observability & failure evidence

Failures leave durable, correlatable records: the server, the scan pipeline, and
the browser each write bounded evidence, and browser records reach the local
store with the next scan flush. This document describes what is recorded, where
it lives, and how to investigate an incident after the fact, including when the
process has already exited; the limits section states what a closed tab can
lose.

## What is recorded

### Server and CLI (`lib/evidence.mjs`)

Every server process and scan run writes JSON-lines events to a local
**evidence store** (default `<repo>/.evidence/`, else `CODE_MAZE_EVIDENCE_DIR`):

- `server.start` / `server.stop` — pid, port, version, signal on stop.
- `scan.start` / `scan.finish` — request mode, repository root, `maxFiles`,
  outcome, duration, node/edge counts, warning count, and on failure an
  `error.category` (`invalid-input`, `permission`, `path-loop`,
  `path-not-found`, or `error` for anything else) with
  the message.
- `http.request` — method, route, status, duration; `client.report` —
  diagnostics deliveries from browsers; `static.read-failure` — static files
  that failed to stream to the browser.

Events that belong to one operation share an **operation id** (`op`). The
response header `X-Operation-Id` returns it to the caller; server events carry
`op` (and `parent` when nested), so `show <op>` reconstructs the full chain.

Storage is bounded and safe by construction:

- Rotation: `events.jsonl` + `events.1..N.jsonl`, `maxBytes` per file
  (default 1 MiB), oldest dropped beyond `maxFiles` (default 5).
- Entries over the 8 KiB line bound collapse to `{truncated: true,
  droppedFields: [...]}` instead of being written whole.
- Secrets are stripped at any depth (keys matching
  `password|secret|token|credential|authorization|api-key|private-key|cookie|bearer`), and
  filesystem paths are redacted to `~/…` with a bounded depth.
- A store that cannot be written never crashes the app: the failure is
  reported once through the write-failure hook (the server logs
  `Evidence store write failed (…): …` to stderr) and counted in `stats()`.

### Browser (`docs/diagnostics.js`)

The browser keeps a bounded ring (60 events) of application failures:
page errors and unhandled rejections (`page.error`), scan failures, seating
worker failures, renderer fallbacks, and photograph-stage failures. Each entry
carries a renderer-state snapshot (allowlisted keys only) and survives reloads
via `sessionStorage` under a persistent `localStorage` session id.

When a scan fails, the client flushes the ring to
`POST /api/diagnostics` with the scan's operation id; the server binds the
bundle to that op. Events recorded outside the scan path (page errors,
seating, renderer, photograph) ship with the next scan flush, and otherwise
stay in the tab's `sessionStorage`. Client timestamps (`clientTs`) are
preserved alongside server receipt time so clock skew is visible.

## Retrieving evidence

`scripts/evidence.mjs` reads the store read-only:

```sh
node scripts/evidence.mjs summary                 # runs, components, outcomes, recent failures
node scripts/evidence.mjs show <operation-id>     # full chain for one operation
node scripts/evidence.mjs list --event scan.finish # filters: --since --until --component --event --op --children --limit --tz
```

Exit codes: `0` results, `1` usage error, `2` no evidence store found.
"No matching events" and "no store" are deliberately distinct answers.

## Investigating an incident (runbook)

You have: a report like "the maze failed yesterday", possibly a screenshot or
an operation id, and no repro.

1. **Find the window.** `node scripts/evidence.mjs summary` lists server runs
   (restarts are visible as pid changes) and recent failures with timestamps.
2. **Pull the chain.** With an op id: `node scripts/evidence.mjs show <op>`.
   Without one: `list --event scan.finish` around the reported time; each
   failure shows its op — then `show <op>` for the request, the server-side
   error category, and any browser bundle bound to the same op.
3. **Read the client side.** Events with `sessionId` and `renderer` came from
   the browser: they show what the user's renderer was doing (WebGL support,
   fallback state) when the failure surfaced, plus `clientTs` for skew.
4. **Distinguish classes.** `path-not-found` → the requested root did not
   exist; `permission` → access denied; `path-loop` → symlink cycle;
   `invalid-input` → the request itself was rejected; `error` → anything else,
   read the message. Browser events without a server failure → client-side
   rendering problem.
5. **Check the store itself.** Corrupt lines are counted, never silent; if the
   store is missing entirely the CLI says so explicitly (exit 2).

What the store cannot tell you: OS-level crashes of the machine, events from
before the store existed, or browser failures on machines where the flush to
`/api/diagnostics` itself failed (those degrade to `sessionStorage` and are
lost with the tab — bounded, by design).

## Relocating the store

Both the server and the scan CLI honor `CODE_MAZE_EVIDENCE_DIR`; the default is
`<repo>/.evidence/` (gitignored). Set it before starting so the server and any
scan runs share one store. The retrieval CLI reads the default store unless
`--dir <path>` (or the same env var) points elsewhere — that is how you
investigate a deployment whose store was relocated.

Recording is always on and bounded; a deployment that must not write to disk
cannot record, and the CLI's exit code 2 makes that visible rather than silent.
