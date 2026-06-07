# ADR: Run the Backend Dev Server Without `bun --watch`

## Decision

The `dev` scripts run the `pst serve` backend with plain `bun`, not `bun --watch` — in the root [package.json](../../../package.json) and [packages/pstdio/package.json](../../../packages/pstdio/package.json). The Vite dashboard keeps its own hot-module reload; the backend is restarted manually after backend edits.

## Context

The backend owns an embedded, single-writer PGlite database (PostgreSQL compiled to WASM) at `$PSTDIO_HOME/pstdio.db` (e.g. `~/.pstdio-dev/pstdio.db`). Running it under `bun --watch` corrupted that database over time, surfacing as `RuntimeError: Aborted()` on the next startup.

Investigation (Bun 1.3.13) showed why:

- `bun --watch` reloads by **re-execing the same process** — the pid stays stable and the JS heap/globals are wiped on each reload (confirmed by probing: a global counter resets to 1 every reload while the pid is unchanged).
- It does **not** deliver `SIGINT`/`SIGTERM` to the running script, so the serve command's shutdown handler — which calls `pglite.close()` — never runs before a reload.
- The data directory is therefore reopened without ever being cleanly flushed/closed → inconsistent WAL → unrecoverable startup.

This is the same corruption class as [PGlite WAL Corruption](../lessons-learned/pglite_wal_corruption.md), reached by a different route: unclean teardown on reload rather than two concurrent writers.

## What changes

| Before | After |
| --- | --- |
| `bun --watch packages/pstdio/src/index.ts -- serve` | `bun packages/pstdio/src/index.ts -- serve` |
| Every backend file edit re-execs serve, leaving PGlite unflushed | Backend runs as one long-lived process; backend edits require a manual restart |
| Dashboard HMR via Vite | unchanged |

## Why not a lock

An earlier attempt added an exclusive lock on the PGlite data directory. It was the wrong layer:

- A lock cannot make an unclean teardown clean — the corruption is a missing flush, not a concurrent open.
- The lock keyed on the owner pid for staleness, but `bun --watch` keeps the **same pid** across reloads, so the reloaded process saw its own lock as "alive," waited, timed out, and never rebound the port. The dashboard then showed nothing on every reload.

## Trade-offs

### Gained: no dev-db corruption

A manual restart (Ctrl-C, re-run) delivers a real `SIGINT`, so `pglite.close()` flushes the database cleanly before the process exits.

### Cost: no backend auto-reload

Backend code changes require restarting `bun run dev` (or just the serve process). Frontend iteration is unaffected — Vite HMR still applies to the dashboard.

## Alternatives considered

- **Data-directory lock** — rejected; see "Why not a lock."
- **Graceful-restart watcher** — a custom watcher that sends `SIGTERM` to a child serve process, awaits a clean exit, then respawns. Preserves auto-reload but adds a bespoke dev script; deferred unless backend reload friction proves costly.
