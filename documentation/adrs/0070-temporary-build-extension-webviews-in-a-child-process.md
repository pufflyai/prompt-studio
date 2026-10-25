# Temporary child-process builds for extension webviews

Proposed: 2026-10-11

Status: Accepted

## Intended design

The runtime builds a managed extension webview from the files on disk when the build starts. An extension update can replace the extension folder, including `node_modules`, while the runtime keeps running. The next build must read the new package files, and its result depends only on the build inputs that [ADR 0050](0050-reuse-webview-bundles-across-restarts.md) names in the build signature.

Ideally the runtime calls `Bun.build` in its own process for each build.

## External limitation

Bun 1.4 caches module resolution inside a process. After a build reads a package, a later `Bun.build` in the same process keeps using that package's earlier `package.json` exports, even after the folder was replaced on disk. Bun has no API to clear this cache.

PS-624 showed the effect. A running host had built Planner's settings view against `@pstdio/ui` 0.41. Planner was then updated to a version whose new timeline view imports `@pstdio/ui/collection-view`, which exists only in `@pstdio/ui` 0.42. The installed files were correct, but every timeline build in that process failed with `Could not resolve: "@pstdio/ui/collection-view"`. The same build passed in a new process. Retrying in the same process kept failing, so no retry rule in the build manager could fix it.

## Decision

Temporarily run each webview build in a child Bun process with the `bun build` command. The arguments come from `extensionWebviewBuildOptions`, the same options object that the build signature hashes. The packaged runtime starts its own binary with `BUN_BE_BUN=1`, as it already does for dependency installs. A runtime started from source starts its own Bun executable. Both use the same Bun version that the build signature records.

The workaround stays inside `extension-webview-builder.ts`. Aborting a build stops its child process. Each build process needs several hundred megabytes, so the builder runs at most four at once, fewer on machines with fewer cores.

PS-624 also changed the build manager. Those changes are not part of this workaround and stay after it is removed: a webview request rebuilds a bundle whose module is missing, and refreshing one source builds its failed webviews again.

## Limitations

- Each build starts a process. This adds a short startup delay to every build. Unchanged bundles are reused, so this cost only applies when a webview actually builds.
- Build errors come from the command output instead of structured `Bun.build` logs. They keep Bun's messages, such as `Could not resolve` and the `bun install` hint.

## Removal

Remove this workaround when `Bun.build` reads replaced package files in a long-running process, or when Bun offers a way to clear its resolution cache. Then call `Bun.build` in process again. Before removing it, run the "builds the dependency files present at build time after an extension folder is replaced" test in `extension-webview-builder.p0.test.ts` against the in-process builder, and repeat the Planner upgrade check from PS-626.
