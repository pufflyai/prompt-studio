# ADR: Build extension webviews on use, with a persisted signature

Proposed: 2026-09-30

## Context

Extensions declare webviews as source files (`.ts`, `.tsx`, `.js`, …). The host bundles each one with `Bun.build` into `$PSTDIO_HOME/cache/extension-webviews`. This lets any extension folder work without its own build step and lets edits appear live in open webviews.

Since PS-25 replaced watch processes with one-shot builds, the host has remembered finished builds only in memory. The runtime also waits for a full rebuild during `createApp()`. As a result, every start rebuilds every installed webview and runtime readiness waits for it. On a real home with 10 extensions, that was 27 bundles and 4 to 7 s on every start (see PS-452 `research.md`).

## Decision

1. A published webview bundle carries the digest of its build signature in `dist/build-signature.txt`. A bundle is current exactly when that digest matches the signature of its current inputs. The inputs are the source graph, the declared dependencies, the Bun version, and the builder options.
2. Webviews build on use. A webview is used when its assets are requested. The first asset request for a webview in a process checks that webview only and waits for the check. Runtime startup and project UI metadata do not build or check webviews.
3. The source watcher keeps watching every installed source. A change rebuilds at once only webviews used in this process. Other webviews are checked again on their next use. A validated source from an explicit reload builds all its webviews at once, so the reload reports build errors.

Starting a replacement build invalidates the old signature. If a build fails and the source is later restored, the next check rebuilds once and clears the recorded failure through the normal success path.

## Consequences

- Runtime readiness no longer depends on the number or size of installed webviews. The ticket prototype measured about 1 s instead of 5.7 to 7.3 s; timings depend on the installed sources and host.
- Restarts reuse unchanged bundles. Edits made while the app was closed are detected on first use.
- A host upgrade that changes Bun or builder options rebuilds each used webview once.
- Build failures of unused webviews appear when a webview is first opened, not at startup.
- The first open of a changed webview waits for its own build only. The asset route makes that request wait instead of returning 404.
- Before its first build, a webview's metadata has no build revision and no style files. The finished build changes the revision, so the dashboard reloads the webview once with its styles.
- Bundles of removed webviews are no longer swept by a full refresh. A separate cleanup must own that.

## Alternatives considered

- **Keep the boot build but run it in the background.** Readiness improves, but every start still rebuilds every installed webview, competes with the first project for CPU, and builds extensions nobody uses. Rejected.
- **Persist the signature in the database.** Freshness is a property of the build output. Storing it in the database creates duplicate state that can disagree with the cache, for example after the cache is deleted. Rejected.
- **Ship prebuilt webview bundles in extension packages.** This removes the host build for catalog extensions, but local and repo extensions would still need host builds, and it adds a publishing step for authors. Out of scope.
- **Start builds from the project UI metadata request.** This overlaps builds with the dashboard's own loading. But it builds every webview of every enabled extension at once. `Bun.build` calls run one after another in the process, so the opened webview waited behind up to 30 builds nobody asked for (about 5 s in the e2e home). Rejected.
