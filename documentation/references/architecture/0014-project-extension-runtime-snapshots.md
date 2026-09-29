# Project extension runtime snapshots

One catalog is the source of loaded extension runtime state for each project. It keeps source loading, normalization, diagnostics, and executable handlers aligned across every consumer.

## Snapshot contents

The [snapshot contract](../../../packages/pstdio-api/src/features/extensions/project-extension-runtime-snapshot.ts) contains:

- A process-wide monotonic publication `generation`.
- The selected project's identity.
- Enabled installed-source records.
- The normalized extension runtime.
- A `stale` marker when a whole replacement load failed and the previous healthy snapshot remains available.

Catalog-owned levels are frozen after publication. Nested loader and database records keep their own mutation rules. Generation changes only when a snapshot publishes; it is not a stored product version or a new identifier for every read.

## Source and project caches

The [source cache](../../../packages/pstdio-api/src/features/extensions/project-extension-runtime-sources.ts) shares one import promise per canonical source path/version. Canonicalization handles the same installed source reached through a symlink or a watcher path.

The project catalog resolves enablement/settings and normalizes those sources into one runtime. Concurrent reads join the same load. A generation invalidated during loading cannot publish after a newer request. Command volume on unchanged sources must not grow imported module identities.

Project command execution, metadata, settings, templates, scheduler, and harness consumers read this catalog. A project harness registry keys its cache by snapshot identity. Host-wide harness discovery is a separate scope.

## Invalidation reasons

| Reason | Meaning |
| --- | --- |
| `source_changed` | Explicitly refreshed or adopted source contributions changed. |
| `webviews_built` | Built asset URLs or build diagnostics changed. |
| `enablement_changed` | The project's selected extension instances changed. |
| `project_workspace_changed` | Workspace context used by the project changed. |
| `runtime_refresh` | An explicit runtime refresh requires a new read. |

Source edits watched outside the development adoption loop rebuild webviews; they do not automatically adopt new contributions. See [installed runtime ownership](0010-extensions-runtime.md).

## Failures and replacement

A rejected source import must not poison the source cache permanently; a subsequent read can retry. Diagnostics retain source identity so failures can be attributed to an installed package.

A whole-project load failure can retain the previous healthy snapshot with an explicit stale diagnostic. Callers must not mistake that for a successfully refreshed project.

Atomic install replacement briefly removes a source directory. While the source is still enabled, the source cache can retain its last healthy value through that replacement gap to avoid tearing down all of its views. Uninstall removes enablement and does not use this exception to keep contributions alive.

## Verification

Validate stable snapshot identity under repeated reads, shared imports under concurrent reads, targeted invalidation, in-flight stale-load rejection, source replacement, broken packages, disable/uninstall, and project separation. Check command execution and metadata from the same snapshot.

See the [requirements](../../requirements/extensions/0001-runtime-snapshots.md) and the catalog tests beside [the runtime implementation](../../../packages/pstdio-api/src/features/extensions).
