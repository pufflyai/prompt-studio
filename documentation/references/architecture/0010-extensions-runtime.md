# Extension runtime

The extension runtime discovers installed sources, validates package contracts, loads contributions, and exposes project snapshots to command, renderer, scheduler, and harness consumers. Package source, adopted project contributions, and built webview assets have distinct lifetimes.

## Package ownership

Extension source and dependencies belong to the package. The host validates `package.json`, imports its declared entry, normalizes contributions, and records diagnostics. It must not silently replace an author's dependencies with unrelated host packages.

User and repository sources use the declared `pstdio.scope`. Project instances select enabled sources and settings. Package identity is the qualified publisher/name pair; install folder names and contribution IDs are different identifiers.

See [manifest and installation](../extensions/0002-manifest-and-installation.md) for source precedence, compatibility, install/update behavior, and the development loop.

## Adoption and asset builds

An ordinary file edit in an installed source does not adopt a new contribution contract. The project continues using its adopted snapshot until an explicit update, reload, install, or development-loop refresh validates and publishes a replacement.

Runtime startup does not build or check webviews. Project UI metadata starts checks for its enabled sources without waiting. Asset requests wait for those checks before serving bundles or build errors.

A SHA-256 digest in each bundle's `dist/build-signature.txt` records its source graph, declared dependencies, Bun version, and builder options. The host reuses matching bundles across restarts and publishes new signatures with successful build output. Starting a replacement build invalidates the old signature. If a build fails and the source is later restored, the next check rebuilds once and clears the recorded failure through the normal success path. Interrupted staging folders are cleaned before the next build, without removing active builds.

The installed-source watcher rebuilds webview assets only for extensions used during this runtime process. Other sources are checked on first use. Explicit reloads and installs build immediately using the validated source. Usage remains active until the process exits. Runtime refresh still removes cache roots no installed source owns. Bundles of removed webviews within an installed source remain for separate cleanup. See [the build decision](../../adrs/0047-build-extension-webviews-on-use.md).

A completed or failed webview build invalidates the relevant projected metadata with reason `webviews_built`; it does not re-read source contributions merely because a file changed.

`pst extensions dev` is an explicit authoring loop. A successful refresh publishes the current validated source. A failed candidate must not be described as adopted. Report its diagnostics and keep the previous valid development runtime according to the refresh contract.

## Shared catalog

One application-owned catalog supplies project snapshots. Consumers do not independently discover and import the same enabled packages on every request. Concurrent reads share source imports and snapshot loading. A snapshot carries one consistent runtime, enabled-source set, diagnostics, project identity, and publication generation.

Commands, UI metadata, templates, settings, schedules, and project harness handles use that same project snapshot. A mutation response updates the dashboard's extension cache before refetching; older reads must not restore pre-mutation state.

See [snapshot architecture](0014-project-extension-runtime-snapshots.md) and its [requirements](../../requirements/extensions/0001-runtime-snapshots.md).

## Imports and dependency resolution

The package loader uses temporary import contexts to obtain fresh module identities without writing cache-busting files into the source package. Package-local dependencies and ancestor resolution must match the extension's declared dependencies. Runtime-owned temporary directories have explicit cleanup ownership.

Bun retains imported module identities for the process lifetime. The source cache therefore imports each source version once across project readers. Repeated commands on unchanged sources must not create a new module identity each time.

Backend development uses Docker isolation and never `bun --watch`. The historical reload limitation is recorded in [ADR 0005](../../adrs/0005-no-watch-backend-dev-server.md); temporary dependency resolution is recorded in [ADR 0017](../../adrs/0017-temporary-local-dependency-install-context.md).

## Harness caching

Project harness registries cache by project catalog snapshot identity. A new adopted snapshot creates the corresponding registry. Host-wide harness discovery has a separate source-path/generation cache. Do not apply the host cache's path signature as the project adoption rule.

Executable detection has a short-lived cache to avoid probing the same provider repeatedly during availability polling. A rebuilt registry invalidates its handle-local detection cache.

## Watching and cleanup

Watchers belong to the application runtime and are disposed on close. Source watching must exclude dependency contents, ignored directories, and recursive symlink walks. On Linux, use bounded non-recursive watches for source directories and shallow dependency-replacement watches; see [the Linux watcher lesson](../../lessons-learned/0012-linux-recursive-fs-watch-crawls-node-modules.md).

During atomic install replacement, a source directory can briefly disappear. The source cache retains the last healthy value only for that bounded replacement case while the source remains enabled. Uninstall removes enablement, so it must not resurrect an uninstalled extension.

## Implementation owners

- [Installed runtime and watchers](../../../packages/pstdio-api/src/features/extensions/installed-extension-runtime.ts)
- [Snapshot contracts](../../../packages/pstdio-api/src/features/extensions/project-extension-runtime-snapshot.ts)
- [Source cache](../../../packages/pstdio-api/src/features/extensions/project-extension-runtime-sources.ts)
- [Harness registry](../../../packages/pstdio-api/src/features/harnesses/harness-registry-service.ts)
- [Extension package](../../../packages/pstdio-extensions)
