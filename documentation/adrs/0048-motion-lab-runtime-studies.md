# Motion Lab runtime studies

Proposed: 2026-09-29

## Status

Accepted in PS-444.

## Decision

Animation studies are project files under `design/motion/studies`, with one metadata file and a default-exported React scene per folder. The Motion Lab extension discovers them on demand and builds each scene with `Bun.build`. It returns the resulting ES module to the preview, which imports a blob URL inside its sandboxed iframe.

A compiled Bun executable and Playwright in the isolated Docker dashboard verified that the compiler works and a blob-loaded scene shares React hooks, Remotion context, and Chakra tokens with its preview. The build maps allowed imports to shared preview module instances. Relative imports stay inside a study folder. Other imports fail with a build error.

The extension owns the shared scene kit, review state, and build cache. Project files own metadata and scene content. Hashes include metadata and all files in a study folder. The tree, palette, and webviews use existing events and refresh subscriptions. Agent turn completion and session completion hooks emit a refresh event. No host API is added.

The scene compiler bundles only study files. It writes each allowed shared import as a `motion-lab-shared:<specifier>` placeholder. The preview replaces each placeholder with a blob module that re-exports its own loaded copy of that library. The server never resolves installed packages for a scene, so a scene build does not depend on the extension's `node_modules` or the host's current directory. This replaces the [temporary separate link pass](0051-superseded-temporary-motion-scene-link-pass.md).

The host emits `session.awaitingInput` after a turn, and `session.succeeded` or `session.failed` when a session ends. The extension subscribes to those events. The declared `session.completed` event is not emitted by the current host.

Study deletion reports the removed resource to the host after deleting files and review state. This clears cached palette entries and uses the shared behavior for closing deleted resources. Opening a stale link still shows the missing-study message.

## Alternatives

Compiling studies into the extension requires adopting new extension source for every edit. Browser compilation would ship a compiler with the preview. A declarative animation language would duplicate capabilities already available in React. Runtime project files use the existing extension interfaces and match agent authoring workflows.

## Consequences

Studies in workspace worktrees appear after merge into the default project folder. External editor changes require Refresh. Scene code has the trust level of other project code. The sandbox must allow blob module imports; a future content security policy must preserve this capability or revisit the decision.

Remotion Studio, CLI video/still exports, and Copy configuration are removed. The Remotion Player remains the renderer. The temporary React subpath alias in ADR 0045 is removed with the Studio configuration.
