# Sessions

`pstdio.session-browser` installs once in the host user scope and can be enabled per project. It owns session browsing and composition. Native chat renders in the workbench document in a full page or shared Side panel. Core owns session identity, execution, transcript, queue, attachments, permissions, workspace links and sync.

New conversations show **Pending** until their first turn starts. Empty saved conversations use the same indicator; completed turns keep their completed status.

Choose **Copy session ID** from a saved session's menu to share its full Prompt Studio ID with another agent. This includes failed sessions. `pst pstdio.session-browser copy-id --session-id <id>` returns the same reference for agent callers.

Hover a saved session’s tab to see its nickname under its title. Choose **Copy session nickname** from the same menu as **Copy session ID**, or run `pst pstdio.session-browser copy-nickname --session-id <id>`. The nickname comes from the saved session ID, so existing and newly saved sessions keep the same nickname after reopening or renaming. Drafts get a nickname when saved. Tab nicknames require a host with extension API 0.6.0.

Other tools use `sessionBrowser` from `@pstdio/sdk/extensions`. This package re-exports the same implementation-free contract from `pstdio-session-browser/refs`. Session and draft resources retain `extensionId: "pstdio"`; navigation refs belong to this provider. New navigation uses provider refs. The host retains deprecated page/panel/command definitions that target the provider renderer, without another chat implementation or persistence owner. Missing or disabled providers use normal unavailable-target feedback.

Each conversation keeps one unsent draft: its text, attachment references and composer
settings, including for projects without a local folder and for conversations running
on another device. Main and Side show the same composer. The draft survives switching
conversations, reloading and, in the desktop app, restarting. Drafts are not
synchronized or recovered across browsers or devices. Sending a message delivers it
to the session's owner. Removing an attachment chip releases its draft reference.

Creation uses `sessionBrowser.commands.create`. With `side: true`, an optional
`panel` placement ref selects an existing compatible destination (for example a
legacy non-Project mode); otherwise the provider uses its Project Side placement.
Draft identity and persistence stay here. “New in this tab” uses the shared
Current view shortcut and captured viewer, without changing Main from Side.
Switch options follow public query cursors rather than truncate older history.

Drag a session into the **Pinned** section or onto a pinned session to keep it at the top of the list. You can also choose **Pin session** or **Unpin session** from a session’s context menu, including for sessions beyond the first history page. Pins use small project-scoped storage records.

Session history loads the next bounded page as the person scrolls toward its end, including within an expanded workspace group. Stable date headings join pages at the same level. This requires a published SDK and host supporting `view.tree.pages.v1`; updating the SDK alone does not update the running host.

## Local development and release

Follow `extensions/AGENTS.md`: use CLI `extensions dev`, then production-like `extensions add --force`, without skipping installation. Local built SDK/UI packages can qualify this stacked implementation. An independent install must use fresh package-local Bun dependencies from built tarballs rather than symlinks or copied installed dependencies.

The backend provider uses only the SDK at runtime. Its canonical patch reducer is
shared through `@pstdio/sdk/extensions`; native rendering stays in the host. The
SDK-only dependency removes the UI package's rendering/editor dependency tree from
each project install without changing message identity or stream behavior.

This provider has an independent version, changelog, and changeset. It stays outside
the host fixed group. `private: true` follows bundled/PSX core-extension conventions.

Host-kept drafts use `ChatViewBody.browserDraft` and require extension API
`^0.5.1`.

## Current implementation checkpoint

Default catalog, provider refs, production native view/list/commands, contextual workspace previews and thin legacy definitions are wired. The implementation is unfinished. Clean installed browser acceptance, complete harness/draft/stream lifetime and performance qualification, and release checks remain. The superseded dashboard chat/list implementation has been removed; retained caller tests load the production provider declarations. Existing unit checks do not establish installed parity.

## Quota recovery

The CLI-ready `quota-availability` command accepts `harnessId` and queries that harness owner's public `quotas` command. Quota commands return `status`, `limits` with `remainingPercent` and optional ISO `resetsAt`, and optional `restartAfterQuotaReset`. Unknown or unsupported snapshots return `known: false`. Exhausted windows return `limited: true`; `resetsAt` is the latest reset only when every exhausted window has a known timestamp and the latest is in the future. Planner uses this public command before waking its supervisor.

A failed conversation with a current-turn quota error can enqueue one idempotent `restart-after-quota-reset` worker when its harness enables the device setting. Durable automation waits until the reset plus 15 seconds. The worker checks current run identity, local ownership, archive state, the native quota and opt-in before sending a guarded continuation. Manual stops, completed turns and unrelated errors stay stopped; a later quota reset schedules a later worker. No application timer or transcript scan runs while the worker is waiting. This requires the host's delayed-automation support in API 0.5.0 on main.
