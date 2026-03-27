# pstdio

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
