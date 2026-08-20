---
status: "shipped"
created: "2026-08-18T17:03:48.668Z"
---

# Product Requirements Document: Project Extension Runtime Snapshots

## Summary

Make one invalidated runtime catalog serve every extension consumer for a project. Repeated commands and reads reuse the same loaded modules, while real source or enablement changes create one new snapshot.

## Problem

The API loads and normalizes enabled extension sources from several routes and runtime helpers. The loader adds a unique query key to each dynamic import. Bun keeps each ESM identity for the lifetime of the API process.

In controlled testing, repeated public and private renderer commands grew API memory on every call. The process exceeded 3.4 GB and Docker killed it with exit 137. A project runtime catalog already exists for skills and templates, but command, event, schedule, settings, and UI paths do not consistently use it.

## Goals

- Import each installed extension source once per source version.
- Give commands, events, schedules, settings, UI metadata, skills, templates, and the harness registry the same normalized snapshot.
- Share one in-flight load across concurrent readers.
- Invalidate snapshots on every real source or project-enablement change.
- Let active work finish against the snapshot on which it started.
- Prove that unchanged command volume does not create new module identities.

## Non-Goals

- Unloading ESM modules from Bun.
- Restarting the API to manage normal command volume.
- Caching command outcomes.
- Keeping stale extension code active after invalidation.
- Hiding memory growth by raising container or CI limits.

## Concepts

| Term | Definition |
| ---- | ---------- |
| Runtime snapshot | Immutable normalized runtime, enabled-source records, settings inputs, diagnostics, and source version identity for one project read. |
| Catalog | Process-owned service that loads, caches, and invalidates snapshots. |
| Source version | Stable fingerprint of an installed extension's runtime files and dependency state. |
| Invalidation | Removal of a cached snapshot so the next read loads current sources. |

## Requirements

### Snapshot Reads

1. All project runtime consumers request a snapshot from the catalog.
2. Repeated reads for unchanged sources return the same snapshot identity.
3. Concurrent initial reads share one promise.
4. A snapshot is immutable after publication.
5. Snapshot normalization uses the project's current linked repository roots.
6. Diagnostics and source attribution come from the same load as executable handlers.
7. A consumer cannot call loadExtensionSources directly for an enabled project runtime.

### Invalidation

1. Installed source reload invalidates every project using that source.
2. Enable, disable, install, uninstall, and extension instance changes invalidate the affected project.
3. Linked repository changes invalidate the affected project's normalized runtime.
4. Dependency changes detected by the source watcher invalidate affected sources.
5. Several invalidations before the next read coalesce into one new load.
6. An invalidation during an in-flight load prevents that stale load from becoming the current snapshot.
7. Commands already executing continue against their captured snapshot.

### Ownership and Lifecycle

1. The application runtime owns one catalog and disposes its watchers on close.
2. Route dependency types receive the catalog, not loader functions.
3. The extension scheduler uses the catalog and does not maintain a competing runtime cache.
4. UI metadata, settings, skill, template, and harness registry services observe the same invalidation generation.
5. Test-only loaders may be injected behind the catalog interface.

### Failure Handling (Decided)

1. A source that fails to import or validate stays in the new snapshot with its identity, empty contributions, and a diagnostic. This matches the current loader, which keeps a broken source's manifest identity and records `extension_import_failed`.
2. One broken source does not block a new generation. Working sources publish; the broken source contributes nothing.
3. After a source change, the catalog never serves that source's old handlers. Broken code surfaces as a diagnostic, not as stale behavior.
4. A whole load that cannot produce a consistent snapshot, such as a failed enabled-source read or a normalization crash, replaces nothing. The catalog keeps the last healthy snapshot, marks it stale with a diagnostic, and retries on the next read.
5. A cold read with no healthy snapshot fails with `extension_runtime_load_failed`.
6. A snapshot never mixes records from two loads.

### Observability

1. Debug logs include project id, snapshot generation, load reason, source count, and duration.
2. Logs do not expose extension settings or runtime capability URLs.
3. A diagnostic endpoint or test hook can report catalog generations and load counts without exposing handler code.
4. A stale load discarded after invalidation is logged.

## Shipped Interface

~~~ts
interface ProjectExtensionRuntimeCatalog {
  get(projectId: string): Promise<ProjectExtensionRuntimeSnapshot>;
  /** Loads one installed source regardless of enablement, for dashboard inspection. */
  getInstalledSourceRuntime(installedSource: InstalledSource): Promise<ExtensionRuntime>;
  invalidate(input: {
    projectId?: string;
    sourcePath?: string;
    reason: RuntimeInvalidationReason;
  }): void;
}

type RuntimeInvalidationReason =
  | "source_changed"
  | "enablement_changed"
  | "repo_link_changed"
  | "runtime_refresh";

interface ProjectExtensionRuntimeSnapshot {
  generation: number;
  project: { id: string; name: string; shorthand: string };
  enabledSources: EnabledExtensionSource[];
  runtime: ExtensionRuntime;
  /** Set only on a retained last-healthy snapshot after a whole-load failure. */
  stale: { code: "extension_runtime_load_failed"; message: string } | null;
}
~~~

Snapshots are frozen after publication. Public callers depend only on snapshot identity and invalidation behavior. Tests may inject a `loadSources` loader and an observer that reports load starts, publications, and discards without exposing handlers.

## Behavior

1. The first project command asks the catalog for a snapshot.
2. The catalog reads enabled sources, imports each current source, normalizes one runtime, and publishes generation 1.
3. Later commands, events, UI metadata, and schedules reuse generation 1.
4. A watched source changes.
5. The installed-source runtime invalidates projects that use the source.
6. The next read builds generation 2 once.
7. Work already running on generation 1 completes normally.

## Success Metrics

| Metric | Baseline | Target | Measurement |
| ------ | -------- | ------ | ----------- |
| Imports per unchanged command | One fresh import set | Zero after warm-up | Injected loader count |
| Concurrent cold reads | May duplicate | One shared load | Catalog concurrency test |
| Source refresh | Independent route reloads | One new generation | Invalidation integration test |
| Repeated-command memory | Grows until OOM | Plateaus after warm-up | Isolated container soak |
| Runtime agreement | Consumers may load separately | Same generation | Route and service contract test |

## Rules and Constraints

- A source version may create at most one published module identity per API process.
- Snapshot invalidation is explicit. Time-to-live expiry is not a correctness mechanism.
- No consumer stores a mutable reference that changes under active work.
- A failed new load reports diagnostics and does not silently present mixed old and new source records.
- Memory validation must not raise existing timeouts or container limits.

## Errors

| Code | Cause |
| ---- | ----- |
| extension_runtime_project_missing | The project no longer exists. |
| extension_runtime_load_failed | A source or normalization step failed before a snapshot could be published. |
| extension_runtime_generation_stale | An in-flight load completed after a newer invalidation. |

## Risks and Open Questions

- Bun still retains imports for genuine source versions. Long development sessions with frequent edits can grow, but growth becomes tied to edits instead of commands.
- Source-to-project reverse lookup must stay current as enablement changes.
- The failed reload policy is decided (see Failure Handling): per-source failures degrade only that source; whole-load failures keep the last healthy snapshot marked stale.
- Scheduler startup must not build a separate cache before the application catalog is ready.

## Rollout Plan

1. Expand the existing project runtime catalog interface and tests. (Done)
2. Add route dependencies and migrate command execution. (Done)
3. Migrate events and schedules. (Done)
4. Migrate UI metadata, settings, skills, templates, and the harness registry. (Done)
5. Remove loadProjectExtensionRuntime and other direct enabled-project loaders. (Done)
6. Add an isolated command soak to packaged validation. (Planned)

## Related Architecture

- [Project Extension Runtime Snapshots](../../.pstdio/docs/architecture/project-extension-runtime-snapshots.md)
