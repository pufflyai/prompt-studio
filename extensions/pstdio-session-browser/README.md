# Sessions

`pstdio.pstdio-session-browser` owns session browsing and composition. Native chat renders in the workbench document in a full page or shared Side panel. Core owns session identity, execution, transcript, queue, attachments, permissions, workspace links and sync.

Other tools use `sessionBrowser` from `@pstdio/sdk/extensions`. This package re-exports the same implementation-free contract from `pstdio-session-browser/refs`. Session and draft resources retain `extensionId: "pstdio"`; navigation refs belong to this provider. New navigation uses provider refs. The host retains deprecated page/panel/command definitions that target the provider renderer, without another chat implementation or persistence owner. Missing or disabled providers use normal unavailable-target feedback.

Draft bodies, files and control values are stored through public project storage, with small record pointers to durable blobs. Projects without a local folder remain supported. The native host transfers legacy `session-drafts` and `session-attachments` snapshots only after a successful durable save. Removing an attachment chip releases that draft reference, not an attachment still used elsewhere.

Creation uses `sessionBrowser.commands.create`. With `side: true`, an optional
`panel` placement ref selects an existing compatible destination (for example a
legacy non-Project mode); otherwise the provider uses its Project Side placement.
Draft identity and persistence stay here. “New in this tab” uses the shared
Current view shortcut and captured viewer, without changing Main from Side.
Switch options follow public query cursors rather than truncate older history.

## Local development and release

Follow `extensions/AGENTS.md`: use CLI `extensions dev`, then production-like `extensions add --force`, without skipping installation. Local built SDK/UI packages can qualify this stacked implementation. An independent install must use fresh package-local Bun dependencies from built tarballs rather than symlinks or copied installed dependencies.

This provider has an independent version/changelog and its own changeset. It stays outside the host fixed group. `private: true` follows bundled/PSX core-extension conventions. Keep published dependency checks enabled; supporting native chat SDK/UI packages must actually publish before the draft consumer PR can leave `waiting-for-release`. Local qualification does not establish published compatibility.

## Current implementation checkpoint

Default catalog, provider refs, production native view/list/commands, contextual workspace previews and thin legacy definitions are wired. The implementation is unfinished. Clean installed browser acceptance, complete harness/draft/stream lifetime and performance qualification, and release checks remain. The superseded dashboard chat/list implementation has been removed; retained caller tests load the production provider declarations. Existing unit checks do not establish installed parity. The consumer PR stacks on prerequisite #1762.
