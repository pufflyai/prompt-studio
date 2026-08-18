# Project Extension Runtime Snapshots

This page defines the target ownership and lifecycle of project extension runtime state. It is proposed by PS-255 and is not implemented yet.

The project extension runtime catalog is the only owner of normalized enabled-project runtime snapshots. Commands, events, schedules, settings, UI metadata, skills, and templates read the same snapshot instead of loading extensions independently.

## Why One Owner Is Required

Loading an extension entry with a new import URL creates a new Bun ESM module identity. Bun retains that identity for the process lifetime.

If each command loads enabled sources independently, normal command volume creates permanent module growth. Cache keys and larger memory limits only delay the resulting process failure. Module identity must change only when extension source state changes.

## Snapshot Contents

A published snapshot is immutable and contains:

- project identity;
- enabled source records and source attribution;
- normalized runtime contributions and handlers;
- settings inputs;
- diagnostics;
- one catalog generation.

All of these values come from the same load. A consumer cannot combine handlers from one generation with metadata or diagnostics from another.

## Catalog Lifecycle

The application runtime owns one catalog and disposes it during shutdown.

```text
first read
  -> resolve project sources
  -> import current source versions
  -> normalize runtime and diagnostics
  -> publish immutable generation

later unchanged reads
  -> return the same snapshot identity

invalidation
  -> mark current generation stale
  -> build one replacement on the next read
```

Concurrent cold reads share one in-flight load promise. Repeated reads for unchanged sources return the same snapshot identity.

## Invalidation

The catalog invalidates affected project snapshots when:

- an installed source changes;
- an extension is enabled, disabled, installed, removed, or explicitly reloaded;
- linked repository extension roots change;
- dependency state changes.

Several invalidations before the next read coalesce into one replacement load. Invalidation is explicit; a time-to-live is not a correctness mechanism.

## Generations and Active Work

Invalidation does not mutate a published snapshot. Work that already captured the old generation may finish against it. New work waits for or receives the replacement generation.

If invalidation occurs during a load, the stale load cannot become current. The catalog discards it and records the reason.

## Consumers

The following consumers receive the catalog through their application dependencies:

| Consumer | Snapshot use |
| -------- | ------------ |
| Commands | Resolve public and private handlers. |
| Events and schedules | Resolve handlers and normalized trigger metadata. |
| Settings | Resolve schemas and current extension identity. |
| Dashboard metadata | Resolve panels, resources, modes, renderers, and diagnostics. |
| Skills and templates | Resolve enabled project catalogs. |
| Harness registry | Build handles from the current enabled source generation. |

No enabled-project consumer may call the package loader or `loadExtensionSources` directly.

## Failure Behavior

A new snapshot is published only after its source records, runtime, and diagnostics are internally consistent.

Failures resolve at two levels:

- **One broken source degrades only itself.** The loader already returns a broken source with its identity, empty contributions, and an import diagnostic. The new generation publishes with that record. The author sees the error, and no stale handlers run after a source change.
- **A whole load that cannot produce a consistent snapshot replaces nothing.** A failed enabled-source read or a normalization crash keeps the last healthy snapshot, marked stale with a diagnostic, and the catalog retries on the next read. A cold read with no healthy snapshot fails with a load error.

Serving a source's old handlers after its code changed would be worse than serving none: writes would run old logic while the author believes new code is active. Keeping the last healthy snapshot is correct only when nothing about the sources changed, which is exactly the whole-load infrastructure case.

Consumers never receive a mixed generation.

## Observability

Debug records include:

- project id;
- generation;
- load or invalidation reason;
- source count;
- duration;
- discarded stale-load events.

Logs and diagnostics do not expose extension settings, handler code, credentials, or runtime capability URLs.

Tests may inspect generation and loader counts through a narrow test hook. Import counts are the deterministic memory invariant; RSS samples are supporting soak evidence.

## Package Boundaries

| Package | Responsibility |
| ------- | -------------- |
| `pstdio-extensions` | Package loading and normalized runtime primitives. |
| `pstdio-api` application runtime | Own the project catalog, invalidation wiring, and route dependencies. |
| Installed-source runtime | Watch sources and tell the catalog what changed. |
| Schedulers and route services | Consume captured snapshots without competing caches. |

## Invariants

- One source version creates at most one published module identity per API process.
- Concurrent cold reads share one load.
- A snapshot is immutable after publication.
- A stale in-flight load never becomes current.
- All enabled-project consumers observe one catalog generation.
- Genuine source revisions may create new retained identities; unchanged command volume may not.

## Related Product Requirements

- [Project Extension Runtime Snapshots](../product/extensions/runtime-snapshots.md)
- [Extension Conformance and Regression Coverage](../product/extensions/conformance.md)
- [Extension Runtime](./extensions-runtime.md)
