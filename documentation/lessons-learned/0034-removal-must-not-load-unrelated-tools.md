# Removal must not load unrelated tools

## When to use

- Checking extension ownership before disable or uninstall.
- Handing a desktop quit request to an active-work confirmation.

## Failure

- Uninstall loaded the whole project runtime to check workspace ownership. A suspended unrelated tool could therefore prevent removal even when the selected tool owned no workspaces.
- A queued source edit inspected the directory after uninstall removed it, producing `ENOENT`.
- Confirmed shutdown did not own the quit guard. Another quit request could overlap cancellation and show recovery while the first request was shutting down successfully.

## Prevention

- Check canonical workspace provider identities before requesting runtime contributions. Resolve the legacy Git provider handoff only when those shared provider IDs require it.
- Empty contribution arrays from manifest-only discovery do not prove a tool has no skills or hooks. Keep actual contribution inspection for provisioning decisions.
- Discard queued source inspection when its source root no longer exists; the root watcher owns registration removal.
- Give each quit operation an owner. Release the initial owner before showing confirmation, and let only the current owner release the guard.

## Evidence

- [Extension lifecycle regressions](../../packages/pstdio-api/src/features/extensions/project-extension-lifecycle.p1.test.ts)
- [Source watcher regressions](../../packages/pstdio-extensions/src/authoring/extension-source-watcher.p0.test.ts)
- [Quit ownership regressions](../../clients/desktop/src/lifecycle/quit-flow.p0.test.ts)
