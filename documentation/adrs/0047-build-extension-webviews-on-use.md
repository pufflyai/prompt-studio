# ADR: Build extension webviews on use, with a persisted signature

Proposed: 2026-09-30

## Context

Extensions declare webviews as source files (`.ts`, `.tsx`, `.js`, …). The host bundles each one with `Bun.build` into `$PSTDIO_HOME/cache/extension-webviews`. This lets any extension folder work without its own build step and lets edits appear live in open webviews.

Since PS-25 replaced watch processes with one-shot builds, the host has remembered finished builds only in memory. The runtime also waits for a full rebuild during `createApp()`. As a result, every start rebuilds every installed webview and runtime readiness waits for it. On a real home with 10 extensions, that was 27 bundles and 4 to 7 s on every start (see PS-452 `research.md`).

## Decision

1. A published webview bundle carries the digest of its build signature in `dist/build-signature.txt`. A bundle is current exactly when that digest matches the signature of its current inputs. The inputs are the source graph, the declared dependencies, the Bun version, and the builder options.
2. Webviews build on use. The first request for an extension's webviews in a process checks them. Requests come from the project UI metadata (without waiting) and from asset requests (waiting). Runtime startup does not build or check webviews.
3. The source watcher keeps watching every installed source. A change rebuilds at once only extensions a project has used in this process. Other extensions are checked again on their next use. A validated source from an explicit reload or install builds at once.

Starting a replacement build invalidates the old signature. If a build fails and the source is later restored, the next check rebuilds once and clears the recorded failure through the normal success path.

## Consequences

- Runtime readiness no longer depends on the number or size of installed webviews. The ticket prototype measured about 1 s instead of 5.7 to 7.3 s; timings depend on the installed sources and host.
- Restarts reuse unchanged bundles. Edits made while the app was closed are detected on first use.
- A host upgrade that changes Bun or builder options rebuilds each used webview once.
- Build failures of unused extensions appear when a project first uses the extension, not at startup.
- The first open of a project after a change waits for that project's changed webviews. The asset route makes those requests wait instead of returning 404.
- Bundles of removed webviews are no longer swept by a full refresh. A separate cleanup must own that.

## Alternatives considered

- **Keep the boot build but run it in the background.** Readiness improves, but every start still rebuilds every installed webview, competes with the first project for CPU, and builds extensions nobody uses. Rejected.
- **Persist the signature in the database.** Freshness is a property of the build output. Storing it in the database creates duplicate state that can disagree with the cache, for example after the cache is deleted. Rejected.
- **Ship prebuilt webview bundles in extension packages.** This removes the host build for catalog extensions, but local and repo extensions would still need host builds, and it adds a publishing step for authors. Out of scope.
- **Build only when an asset is requested.** This is the simplest trigger, but it would make the first render of every changed webview wait for its build. Starting builds from the project UI request overlaps them with the dashboard's own loading. Kept as the fallback path inside the asset route.
