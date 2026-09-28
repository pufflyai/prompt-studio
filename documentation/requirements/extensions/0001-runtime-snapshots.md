---
status: "current"
created: "2026-08-18T17:03:48.668Z"
---

# Project extension runtime snapshot requirements

## Problem

Loading extensions independently for every command, settings read, or renderer request duplicates work and creates new ESM import identities. Bun retains those identities for the process lifetime. Consumers can also disagree if metadata and executable handlers come from different source reads.

## Required behavior

1. One application-owned catalog serves all extension consumers for a project.
2. Repeated reads of unchanged state reuse the same published snapshot and source imports.
3. Concurrent reads share loading work. Invalidations during a load prevent obsolete publication.
4. A snapshot contains a consistent normalized runtime, enabled-source records, project identity, and diagnostics.
5. Project commands, views, scheduler, templates, settings, and harnesses consume that snapshot.
6. Source and enablement changes invalidate the affected project set. One project's mutation must not unnecessarily invalidate every project.
7. Watcher-driven webview rebuilding must remain separate from explicit contribution adoption.
8. The application owns watcher/cache lifetime and disposes watchers on close.

## Adoption and invalidation

A project adopts validated contributions through explicit lifecycle operations or `pst extensions dev`. Merely editing an installed source does not replace that adopted contract.

The shipped invalidation reasons are `source_changed`, `webviews_built`, `enablement_changed`, `project_workspace_changed`, and `runtime_refresh`. Built webview metadata can change without adopting a different contribution set.

The [source contract](../../../packages/pstdio-api/src/features/extensions/project-extension-runtime-snapshot.ts) defines exact snapshot fields and error types. [The architecture reference](../../references/architecture/0014-project-extension-runtime-snapshots.md) explains cache and publication ownership.

## Failure requirements

- Invalid source imports must expose actionable diagnostics and remain retryable.
- Whole-load failure may retain the last healthy snapshot only with an explicit stale marker.
- Failed validation must not be presented as successful adoption.
- A temporary directory gap during atomic install replacement may retain the still-enabled source's last healthy value. This must not retain disabled or uninstalled contributions.
- Missing projects must preserve the API's project-not-found behavior.

## Observability and acceptance

Use source-load counts, snapshot identities, generations, and diagnostic outcomes to prove the behavior. Repeated unchanged reads and command volume must not continually import fresh module identities.

Cover concurrent reads, source replacement, settings/enablement changes, webview rebuilds, project-workspace changes, stale in-flight loads, broken packages, retry after failure, and shutdown cleanup. Metadata and command execution must identify the same adopted source.

A passing cache test does not prove the installed user flow. Check install, use, update, disable/remove, restart, and recovery with the [manual walkthrough](../../lessons-learned/0013-manually-check-installed-user-flows.md).
