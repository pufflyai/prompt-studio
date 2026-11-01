# Motion Lab runtime studies

Proposed: 2026-09-29

Status: Accepted in PS-444. Consolidates the retired Remotion subpath alias (ADR 0045) and separate scene link pass (ADR 0051).

## Decision

1. Keep study metadata and default-exported React scenes in project folders under `design/motion/studies`. The extension owns the scene kit, review state, and build cache.
2. Compile study files on demand with `Bun.build`. Relative imports stay inside the study; unsupported imports fail.
3. Mark allowed shared imports with `motion-lab-shared:<specifier>`. The sandboxed preview replaces them with blob modules re-exporting its loaded library instances.
4. Never resolve installed packages on the scene server. Builds must not depend on its current directory or `node_modules`.
5. Hash metadata and every study file for caching. Refresh through existing tree, palette, webview, and session events; add no host API.
6. Report deleted studies to the host so cached entries and open resources are cleared. Stale links show the missing-study state.

## Why

- Compiling studies into the extension required replacing extension source for every edit. Browser compilation shipped a compiler; a custom animation language duplicated React.
- Remotion Studio's React alias broke `react/compiler-runtime`. Studio and CLI exports were retired; the Remotion Player remains.
- Server export discovery needed nested Bun builds that stalled. Eager discovery exceeded the existing five-second limit; cached failed package lookups could break a long-lived host. Preview-owned modules remove both export discovery and the extra link pass.

## Consequences

- A compiled executable and the isolated browser preview verified shared React hooks, Remotion context, and Chakra tokens.
- Worktree studies appear after merge into the default project folder. External edits require Refresh.
- Scenes have the trust level of project code. Preview sandboxing and any future content security policy must permit blob module imports.
