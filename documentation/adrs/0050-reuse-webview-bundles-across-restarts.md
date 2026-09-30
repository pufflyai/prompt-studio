# ADR: Reuse webview bundles across restarts with a persisted signature

Proposed: 2026-09-30

## Context

Extensions declare webviews as source files (`.ts`, `.tsx`, `.js`, …). The host bundles each one with `Bun.build` into `$PSTDIO_HOME/cache/extension-webviews`. This lets any extension folder work without its own build step and lets edits appear live in open webviews.

Since PS-25 replaced watch processes with one-shot builds, the host has remembered finished builds only in memory. The runtime also waits for a full rebuild during `createApp()`. As a result, every start rebuilds every installed webview and runtime readiness waits for it. On a real home with 10 extensions, that was 27 bundles and 4 to 7 s on every start (see PS-452 `research.md`).

## Decision

1. A published webview bundle carries the digest of its build signature in `dist/build-signature.txt`. A bundle is current exactly when that digest matches the signature of its current inputs. The inputs are the source graph, the declared dependencies, the Bun version, and the builder options.
2. Runtime startup checks every installed source's webviews in the background. Readiness does not wait. A check hashes the inputs and builds only bundles whose signature does not match.
3. Project UI metadata waits for the checks of the project's enabled sources. Asset requests (GET and HEAD) wait for the checks of their source. The metadata names each built bundle's revision and style files, so it must describe finished builds.
4. The source watcher, installs, and explicit reloads check the changed source at once, as before.

Starting a replacement build invalidates the old signature. If a build fails and the source is later restored, the next check rebuilds once and clears the recorded failure through the normal success path.

## Consequences

- Runtime readiness no longer depends on the number or size of installed webviews. The ticket prototype measured about 1 s instead of 5.7 to 7.3 s; timings depend on the installed sources and host.
- Restarts reuse unchanged bundles. Edits made while the app was closed are found by the startup check.
- A host upgrade that changes Bun or builder options rebuilds every webview once, in the background.
- If a project opens while the startup check still builds, its metadata waits for that project's webviews.
- Metadata never names a bundle that is still missing, so a first build does not reload open webviews or re-register contributions while the user works.
- Bundles of removed webviews are no longer swept by a full refresh. A separate cleanup must own that.

## Alternatives considered

- **Persist the signature in the database.** Freshness is a property of the build output. Storing it in the database creates duplicate state that can disagree with the cache, for example after the cache is deleted. Rejected.
- **Ship prebuilt webview bundles in extension packages.** This removes the host build for catalog extensions, but local and repo extensions would still need host builds, and it adds a publishing step for authors. Out of scope.
- **Build webviews only when used.** Building when metadata or an asset is first requested skips unused extensions. But the metadata names build revisions and style files, so it is wrong until the build finishes. Each finished build changed the metadata and reloaded open webviews of the extension while the user worked. This broke settings panels, player views, and form input in the e2e suite. `Bun.build` calls also run one after another in the process, so an opened webview waited behind every other build started with it. Rejected.
- **Keep the boot build and wait for it.** With persisted signatures an unchanged home only hashes inputs, but a first run or upgrade would again block readiness for seconds. Rejected.
