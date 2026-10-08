# ADR: Trust step for repo extensions

Proposed: 2026-10-06

## Status

Proposed. Not implemented. PS-526 builds it.

## Context

Installs and updates are meant to be explicit: source that appears in an extensions root is never adopted on its own ([manifest and installation](../references/extensions/0002-manifest-and-installation.md)). User extensions follow this rule. They stay disabled until a person enables them.

Repo extensions do not. `packages/pstdio-api/src/features/extensions/repo-extensions.ts` loads every folder under `<repo>/.pstdio/extensions` with a plain `import()` of its entry (`packages/pstdio-extensions/src/runtime/loader.ts`), then enables it. The entry's top-level code runs before the host decides whether the folder conflicts with another source or should be skipped. This happens when a project is created from a folder (`packages/pstdio-api/src/features/projects/project-folder.ts`), at every startup for every project (`packages/pstdio-api/src/startup/index.ts`), and when the repo-root watcher sees a new folder (`installed-extension-runtime.ts`).

So a person who clones a third-party repository, or pulls a branch that adds `.pstdio/extensions/x/extension.ts`, runs that code as soon as the folder opens. An agent that may only write inside the project can add such a folder and get its code run outside its limits at the next startup. Because extension backends run inside the API process (ADR 0058), that code has the whole account. The audit in PS-497 (security finding 3) confirmed this.

## Decision

1. Discovery never imports a repo extension. Project creation, startup, and the watcher read only the folder's `package.json` metadata, the same way `readPackageManifestMetadata` does today.
2. A newly discovered repo folder is registered **disabled**, like a user extension. The extension panel lists it with its source folder and an action to enable it.
3. Enabling a repo folder is the approval. It records the source hash that the person approved. Enabling is possible in the dashboard and through the CLI, because a person and an agent use the same interface (MISSION rule 4).
4. The host imports an enabled repo source only when the folder's current content hash equals the approved hash. When the content changed, for example after a `git pull`, the host keeps the extension unloaded and shows **Reload**. Reload is an explicit approval of the new hash. This matches the existing rule that edits are adopted only by Reload, Upgrade, reinstall, or `pst extensions dev`.
5. Explicit actions that already name a source count as approval: `pst extensions add <path>`, the folder drop zone, `pst extensions dev <path>`, and installing a catalog extension.
6. The approval lives in the host's own data, never in the repository. A repository cannot approve itself.
7. Prefer existing data. The installed-source record already stores the adopted `source_hash`. PS-526 must check whether it can serve as the approved hash before adding new state.

## Consequences

- Opening an untrusted repository no longer runs its extension code. The person sees its extensions in the panel and decides.
- Developers of this repository enable each repo extension once per project. After that, editing their own extension needs a Reload or the `pst extensions dev` loop, which is already the documented authoring flow.
- Startup reads one hash per enabled repo extension before import. `hashExtensionSource` already runs for these sources, so the extra cost is small.
- Until scoped agent tokens exist (PS-503 item F), any holder of the runtime token can approve, including an agent that runs `pst`. The trust step then stops code from running when a folder opens or on startup, but it does not stop an agent that both writes the folder and enables it. If approval becomes human-only, that exception must be written next to MISSION rule 4.

## Alternatives considered

- **Trust a whole folder, like VS Code Workspace Trust.** One approval per project folder is less work for the person, but a later `git pull` would run new code with no prompt. Keying on the content hash closes that gap and reuses the existing Reload flow. Rejected.
- **Approve inside the repository, for example in `.pstdio/config.json`.** The repository is the untrusted input, so it cannot hold the approval. Rejected.
- **Keep auto-enabling and rely on process isolation (ADR 0058).** Isolation limits what code can reach, but running unapproved code at all still breaks the explicit adoption rule. Both are needed. Rejected as a replacement.

## Open questions

- Whether an agent session may approve trust, or only a person. This is the same question as scoped agent tokens in PS-503 item F.
