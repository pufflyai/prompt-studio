# Removal must not load unrelated tools

## When to use

- Checking extension ownership before disable or uninstall.
- Handing a desktop quit request to an active-work confirmation.

## Failure

- Uninstall loaded the whole project runtime to check workspace ownership. A suspended unrelated tool could therefore prevent removal even when the selected tool owned no workspaces.
- A queued source edit inspected the directory after uninstall removed it, producing `ENOENT`.
- Confirmed shutdown did not own the quit guard. Another quit request could overlap cancellation and show recovery while the first request was shutting down successfully.
- A runtime can announce its intentional stop before its HTTP acknowledgement is lost. Treating that failed response as refusal overwrote the announced shutdown with recovery.

## Prevention

- Check canonical workspace provider identities before requesting runtime contributions. Resolve the legacy Git provider handoff for either predecessor or successor when shared provider IDs require it; aliases alone cannot establish which extension currently owns them.
- Empty contribution arrays from manifest-only discovery do not prove a tool has no skills or hooks. Keep actual contribution inspection for provisioning decisions.
- Discard queued source inspection when its source root no longer exists; the root watcher owns registration removal.
- An existence check cannot prevent deletion starting during a recursive hash. Uninstall must delete source bytes on the exclusive preparation worker that owns source watches, so its synchronous hashing and deletion cannot overlap. Keep external source folders intact.
- Give each quit operation an owner. Release the initial owner before showing confirmation, and let only the current owner release the guard.
- A confirmed window choice supersedes an unanswered native dialog. Its later answer or failure cannot cancel the confirmed shutdown or start a second one.
- Reconcile a lost shutdown response with the durable shutdown record for that exact process and instance. Detaching is not evidence of shutdown; an older response must not affect a replacement runtime.

## Evidence

- [Extension lifecycle regressions](../../packages/pstdio-api/src/features/extensions/project-extension-lifecycle.p1.test.ts)
- [Source watcher regressions](../../packages/pstdio-extensions/src/authoring/extension-source-watcher.p0.test.ts)
- [Quit ownership regressions](../../clients/desktop/src/lifecycle/quit-flow.p0.test.ts)
- [Shutdown response regressions](../../clients/desktop/src/runtime/runtime-manager.p0.test.ts)
