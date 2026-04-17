# pstdio

## 0.7.0

### Minor Changes

- 013310f: Fix OpenCode session timeout and restart recovery: separate provider-managed lifecycle from activity-managed lifecycle and add disconnected session status
- b01f555: Show plugin actions in ticket, session, and workspace headers.

### Patch Changes

- b01f555: Set selected text in dark mode to use `fg.inverted` for better contrast on accent highlights.
- b01f555: Refresh the orange theme palette for clearer warning states.
- 36cbefa: Add durable activity-events database schema and query service with cursor pagination.
- f95b332: Strip non-letter characters from project shorthands
- e100c9b: Add built-in workspace archive/delete actions with API-backed mutations and delete confirmation.
- b01f555: Fix legacy plugin ticket actions and cover required action params in e2e.
- 48e08db: Show the tickets list header as a breadcrumb with the shared Tickets icon label.
- e242254: Deprecate the post-hook queue: `postAttemptStatusChange` now fires immediately on transition instead of being deferred until the session reaches a terminal state.
- b1e3fda: Add empty placeholder in ticket sidebar when workspace list is empty.
- b01f555: Use the shared primary button style for dashboard call-to-action buttons.
- b01f555: Restore semantic sidebar icon colors for session status rows.
- 3dd7a83: Fix attempt creation so the worktree starts from the freshest commit on the chosen branch and the branch sent in the request matches what the branch selector displays.
- c9a2e69: Resolve plugin action targets by shorthand so `ctx.target` is populated when a ticket or workspace shorthand is passed as `target_id`.
- c9a2e69: Fix `pstdio tickets save` failing with opaque `[object Object]` errors when the ticket had a `blocked_reason` frontmatter field, and surface zod validation errors in the SDK client instead of stringifying them.
- c9a2e69: Recover stale OpenCode sessions and reconnect dropped session streams.
- b01f555: Hide the attached session panel workspace hub while viewing workspace routes.
- e11371e: Add deferred workspace-scoped session drafts from the ticket sidebar sessions section.
- b01f555: Add a bundled workspace plugin action to open the workspace worktree in VS Code.
- b01f555: Extract reusable bubble and attached panel shells into @pstdio/ui and keep the attached panel mounted across layout-story navigation.
- e242254: Improve shared searchable menus for parent-child list switching and clearer browser headers.
- f95b332: Persist new ticket modal content across dashboard refreshes.
- 2fd38e9: Hide the session workspace hub in bubble view while on workspace routes.
- 3a77d88: Support multi-file bundled skills end-to-end across install paths, API responses, and dashboard skill viewing.
- 62d3854: Highlight both the workspace and its active session in the ticket sidebar
- e242254: Use the compact menu item styling for the session selector footer.
- b01f555: Add `pstdio plugins list` and `pstdio plugins register` commands.
- 3dd7a83: Allow dashboard actions to run independently while other actions are in flight.
- 62d3854: Auto-select and persist workspace session selection in ticket workspace navigation
- b01f555: Preserve the current session panel layout when switching sessions from ticket and workspace navigation.
- f21a710: Improve workspace diff loading, file navigation, and sidebar planning navigation cues
- c9a2e69: Source OpenCode turn liveness from server polling instead of the POST /message HTTP lifetime, so long-running turns no longer get marked disconnected when the POST request times out.
- c9a2e69: Fix bare URLs rendering as clickable links in rich messages.
- e242254: Clarify the default code review template structure and review criteria.
- 8678885: Reuse the shared file list panel for workspace checks so artifacts get the same tree/search/view-mode controls as the diff view.
- 8678885: Add workspace Changes/Checks tabs with DB-backed artifact persistence and refresh behavior.
- 1bd5113: Improve ticket and workspace breadcrumbs with ticket titles and short attempt labels
- a4b7665: Remove the "Open in VS Code" action from the bundled workspace-actions plugin template.
- c9a2e69: Show workspace diff regardless of session status — previously the diff panel was hidden until the workspace's latest attempt session reached a settled state.
- 3a77d88: Render the project settings skill viewer with a file tree (icons + folders) and move the skill title and description above the editor so they align with its width. On startup, also auto-sync existing project skills that still hold a single SKILL.md file with the latest bundled multi-file skill (when the SKILL.md content is unchanged), and reinstall them to repos.
- 013310f: Reattach orphaned OpenCode sessions on server restart instead of marking them disconnected
- 3dd7a83: Fix local checkout CLI startup when `pstdio` is launched outside the repo root.
- b01f555: Make attached session panels resizable in the dashboard and shared UI shell.
- fb19526: Open selected sessions when the panel is closed while preserving attached mode
- 2eaa0b3: Replace ticket workspace/session indicators with a unified workspace badge, including attempt-status tooltip support and sidebar/board integration.
- 3dd7a83: Fix local workspace docker runs and improve long error toasts.
- b01f555: Add a workspace diff-panel empty state when no file changes are available.
- b01f555: Adjust dark active background color to better match the shared theme.
- b01f555: Move the version entry from the shared sidebar project menu into the dashboard Help menu.

## 0.6.1

### Patch Changes

- 42c9d33: Fix starter plugin backfill for linked repos.
- 42c9d33: Fix packaged pstdio plugin loading for project TypeScript plugins.
- 42c9d33: Use package version instead of PSTDIO_VERSION.

## 0.6.0

### Minor Changes

- 1d384f8: Add getAttemptsForTicket helper for plugin ticket attempts lookup.
- 1d384f8: Split SDK ticket attempt helpers into session-backed createAttempt and workspace-only createWorkspace.

### Patch Changes

- 1d384f8: Rename SDK hooks to pre/post naming and document the updated SDK hook cookbook.
- 1d384f8: Add a `createSession` plugin helper that automatically injects `project_id` from plugin context.
- 1d384f8: Make session hook contexts expose `ticket` and `workspace` as full objects when a workspace is linked.
- 1d384f8: Add a workspacesForTicket plugin helper for ticket-scoped workspace lookups.
- 1d384f8: Move `renderPrompt` off the SDK root export and keep it available from `@pstdio/sdk/prompts`.
- 1d384f8: Publish the SDK from built dist artifacts instead of raw source.
- 1d384f8: Surface rich ticket and workspace hook objects.
- 1d384f8: Stabilize attempt session hooks until linked worktree setup completes.
- 1d384f8: Keep plugin-backed API routes working when `.pstdio` SDK installation is unavailable.
- 1d384f8: Expose ticket/workspace objects in session hook contexts.
- 1d384f8: Add a plugin follow-up helper and fix review lifecycle session routing.
- 1d384f8: Include ticket status_name in session hook ticket context and SDK typing.
- 1d384f8: Use wildcard workspace manifest copies in Docker builds to avoid hand-maintained package lists.
- 1d384f8: Consolidate plugin runtime boundaries: introduce pstdio-api-contracts for shared API types, make SDK and API consume contracts, move hook dispatch into pstdio-plugins/hooks, delete pstdio-hooks
- 1d384f8: Restore documented default pstdio plugin templates
- 1d384f8: Keep SDK root imports scoped to shared client and types.
- 1d384f8: Rename bundled plugin templates from .ts to .ts.txt to avoid TypeScript tooling interference.
- 1d384f8: Add SDK plugin helpers for common CLI workflows and expose missing ticket/workspace status helper endpoints.
- 1d384f8: Narrow plugin action `ctx.target` by `targetType` discriminant — no cast needed.
- 1d384f8: Align TypeScript dependency ranges to ^5.9.3 across workspace packages.
- 1d384f8: Backfill missing starter plugins when reopening linked repos.
- 1d384f8: Allow runCommand to accept Bun.spawn directly.
- 1d384f8: Update setTicketStatus helper input to { ticket, status }.
- 1d384f8: Use DB-backed prompt templates for `tickets implement` instead of packaged prompt files.

## 0.5.1

### Patch Changes

- 2af6eba: Stabilize asynchronous hook tests by polling for hook outputs instead of relying on fixed sleeps

## 0.5.0

### Minor Changes

- 00001f2: Add --template and --var flags to sessions create and follow-up commands
- 00001f2: Add attempt-status hooks: blocking pre-hooks that gate status transitions and deferred post-hooks that fire after session completion
- 00001f2: Add shared pino-based runtime logging with configurable JSONL targets across CLI, API, and hooks.

### Patch Changes

- 3e8d1b7: Add API service layer to centralize state-transition orchestration (DB update + EventBus emit + hook firing) for sessions, tickets, and workspaces
- 3e8d1b7: Use the configured default agent for sessions created without --agent.
- 00001f2: Include workspace ticket in attempt-status hook payloads.
- ce8bf76: Refine bundled pstdio skills: remove stale review references, clarify status handling, and split CLI guidance into references.
- ce8bf76: Fix packaged project setup.
- 3e8d1b7: Add structured Hono request logging middleware for API routes.
- 00001f2: Surface pre-hook rejection output when setting workspace attempt status.
- 00001f2: Archive ticket-linked workspaces and sessions together.
- 00001f2: Fix hook logging to recreate the hooks logger when log destination env settings change in-process.
- ce8bf76: Ensure API-managed hooks stay executable and run consistently across all session status-transition paths.
- 00001f2: Add `workspaces list-statuses` and point `workspaces set-status --help` to it.
- 00001f2: Fire post attempt-status hooks immediately when no session id is provided.
- 00001f2: Propagate `original_session_id` into attempt-status hook payloads for session-driven status updates.
- 00001f2: Fix Claude follow-up hangs and reset session timeouts on stream activity.
- 00001f2: Fix Claude follow-up message ordering in the dashboard stream and add provider E2E regression coverage.
- 3e8d1b7: Rename ticket worktree cleanup commands to `tickets worktrees` and add `list` plus `remove-all` subcommands.
- 5684e88: Move `pstdio-logging` to devDependencies so changeset versioning remains valid.
- 00001f2: Fall back to PSTDIO_SESSION_ID in workspaces set-status.
- 00001f2: Fix worktree creation failing when prunable (stale) worktree entries exist
- ce8bf76: Include workspace attempt statuses in session hook payloads so post-session-success can react to review-ready and blocked states.

## 0.4.0

### Minor Changes

- 16dc458: Add `tickets clean-worktrees` CLI command and `post-ticket-archive` hook template to remove worktrees on ticket archive.
- 277d7c9: Replace workspace.session_id with workspace_sessions join table to support multiple sessions per workspace

### Patch Changes

- 8eaf4ac: Add docs initialization guidance to the bundled documentation skill.
- 8eaf4ac: Add a hooks create command and document all supported hook types.
- 8eaf4ac: Fix validate failures in ticket attempts and session chat flows
- 277d7c9: Persist blocked_reason frontmatter and mark saved tickets as non-draft
- 8eaf4ac: Add version metadata to bundled skill templates.
- 16dc458: Fix missing workspace setup translations in the session workspace hub.
- 8eaf4ac: Document hook creation in the bundled pstdio skill template.
- 16dc458: Restore chat input top corners when the workspace hub is hidden
- 8eaf4ac: Create the default post-worktree-create hook when new projects register a repo.
- 277d7c9: Persist parent_id frontmatter when saving tickets
- 47b5f7a: Keep ticket cards within kanban column bounds by wrapping long unbroken title strings and add Storybook coverage for URL-like tokens.
- 8eaf4ac: Add a shared searchable menu for hooks and repo branch selection.
- 277d7c9: Show parent shorthand in the ticket details panel
- 8eaf4ac: Add a token usage story for the chat message parts renderer.

## 0.3.0

### Minor Changes

- 49e6c52: Redesign tags as typed field definitions with options (single-select/multi-select).

### Patch Changes

- 8b04ba9: Improve the documentation empty state with repo authoring guidance
- 8b04ba9: Show a workspace diff hub above session chat inputs for workspace-backed sessions.
- abadf39: Replace read-only Monaco diff surfaces with git-diff-view and add adapter coverage tests.
- 8b04ba9: Keep the first session message visible while a new session starts streaming.
- 8b04ba9: Make project navigation open tickets by default
- 8b04ba9: Fix workspace diff CPU spike: only fetch diffs for settled attempts on kanban, add lightweight diff-summary endpoint, refresh diffs on edit actions in workspace page. **Breaking:** `resolveBase` now prefers the reflog fork point over merge-base, so diffs reflect the actual branch creation point rather than moving with the default branch.
- 8b04ba9: Keep ticket attachment lists in sync after saves and show icons in the ticket sidebar.
- 8b04ba9: Keep session streams alive with heartbeat events and raise Bun idle timeout to 20 seconds.
- 8b04ba9: Add repositories panel to project settings with remove support
- 8b04ba9: Prevent chat repo controls from wrapping
- 0a1f61d: Sort tickets in kanban columns by `created_at` in the default manual ordering.
- 8b04ba9: Replace the session chat empty state with a reusable chat skeleton and unavailable-session fallback.
- 8b04ba9: Use dashboard translations in session chat stories.

## 0.2.1

### Patch Changes

- 403da88: Resolve stale in_progress session status to completed when process handle is lost.
- 205cf2d: Add a Skills section in project settings so users can browse installed skills and read their content in the dashboard.
- 05705ba: Remove the backend connection indicator dot from the dashboard layout.
- 403da88: Fix server startup blocking by making orphaned session resolution non-blocking
- 6e577b6: Add template-aware docs rendering so changelog docs entries use the changelog UI.
- 14b174f: Reshape global settings into a sidebar Agents panel and support manual agent setup with executable paths.
- 05705ba: Use ScrollArea for rich-text content editable scrolling.

## 0.2.0

### Minor Changes

- 7289bdd: Add worktree lifecycle hooks system. Define shell scripts in `.pstdio/hooks/<hook-name>` to run automatically during create, commit, merge, rebase, and remove events. Replaces startup_script with post-create hook.

### Patch Changes

- b3e224d: Recover from incomplete embedded migration extraction
- 7289bdd: Improve chat message spacing and add scroll-area handling for rich messages and chat input.
- c88802f: Add a configurable TicketsWorkspace with persisted display settings, filtering controls, and ticket grouping utilities.
- 7289bdd: Align packaged runtime smoke expectations with the current bundled template seed set.
- d245e21: guard template type updates and fallback invalid settings template routes

## 0.1.7

### Patch Changes

- f711a25: Improve dashboard tab titles for deep project and template settings views.
- 15bf046: Enable ticket details to select, edit, and autosave attached ticket files with URL-synced file selection.
- 20c6787: Sync local ticket file frontmatter when updating ticket status via CLI.

## 0.1.6

### Patch Changes

- 1b823eb: Allow creating project templates with empty content from dashboard settings and cover the flow with a UI e2e regression test.
- d925ee7: Update dashboard page titles to reflect the active project view.
- 79285d3: Add startup script save/pull workflows and settings editor
- 79285d3: Run startup scripts in backend workspace creation for CLI, dashboard, and API flows.
- cad7cc9: Persist unsent chat drafts per session and cap composer height in the sessions chat panel.
- a62b18b: Auto-start ticket refinement sessions from the tickets board when a create action uses a ticket template.
- de3bae4: Keep the new-session chat editor stable while typing and add a sessions e2e regression test that verifies focus is retained across consecutive keystrokes.
- 06ebefb: Remove linked git worktrees when workspaces are deleted or archived.

## 0.1.5

### Patch Changes

- 10d3b38: Update Discord links to the current community invite URL.
- 6ac92d7: Fix untracked file diff stats so new files show correct addition counts.
- 6ac92d7: Fix sync stream race condition that could drop session status updates during SSE bootstrap
- 10d3b38: Generate the pstdio package README from the root README during publish.
- a3cfc65: Add router-agnostic SidebarNext and SidebarTree components with persisted zustand state and story-driven behavior coverage.

## 0.1.4

### Patch Changes

- 07e2570: Fix project creation flow and sync delete handling in dashboard.
- 186ce1e: Show model and repo selectors in workspace conversation chat.
- 186ce1e: Fix dashboard ticket card session indicator to use session lifecycle status.
- 370ca01: Fix packaged project creation seeding in compiled binaries

## 0.1.3

### Patch Changes

- 9f1143f: Fix dashboard serving wrong content-type for root path, skip duplicate GitHub releases, fix version script formatting and lock file sync

## 0.1.2

### Patch Changes

- 9e42007: Fix npm entrypoint failing under Node.js due to require() in ESM scope by renaming bin/pstdio.js to bin/pstdio.cjs

## 0.1.1

### Patch Changes

- 08be990: Add optimistic follow-up messaging and keep chat input focused after send.
- a853ae3: Hide archived sessions in the sessions panel and hide the session bubble on sessions routes.
- a853ae3: Prevent PGlite corruption by rejecting concurrent DB opens and closing on startup failures.
- a853ae3: Hide draft tickets from the dashboard tickets panel list and board views.
- a853ae3: Inject the CLI version from package metadata so compiled binaries report the correct version.
- 08be990: Open the session bubble for implement and refine ticket submits.
- 08be990: Switch ticket local directories to shorthand-only paths and automatically normalize legacy slugged folders.
- 08be990: Improve session UX by returning Open in bubble to the last non-sessions page and exporting full conversation JSON.
- a853ae3: Fix session bubble rendering, musl binary resolution, and release version sync ordering.
- a853ae3: Ensure tickets write always sets draft: true in local frontmatter.
- a853ae3: Handle session stream `/messages` full-array add/replace patches in the dashboard chat reducer.
- 08be990: Skip empty session message parts when storing and rendering.
- 08be990: Show ticket board card session indicators and workspace diff badges with direct open actions.
- a853ae3: Trim bearer tokens before API authentication checks.

## 0.1.0

### Minor Changes

- 5134866: Initial release

### Patch Changes

- 35b773f: Replace the bundled legacy requirements template with a merged `prd` template and update docs and skills to scaffold requirements docs with `prd`.

  Add a bundled `lessons-learned` postmortem template and document it across pstdio skills and template docs.
