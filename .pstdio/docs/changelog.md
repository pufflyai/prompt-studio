---
status: "draft"
created: "2026-03-20T00:00:00Z"
---

# Changelog

This changelog is generated from published git tags and current unreleased changes on `main`.

## Upcoming

### pstdio `0.1.7` (unreleased)

- Enable ticket details to select, edit, and autosave attached ticket files with URL-synced file selection.
- Improve dashboard tab titles for deep project and template settings views.
- Guard template type updates and fallback invalid settings template routes.
- Sync local ticket file frontmatter when updating ticket status via CLI.

## Published

### 2026-03-17

#### pstdio `0.1.6` (`pstdio@0.1.6`)

- Allow creating project templates with empty content from dashboard settings and cover the flow with a UI e2e regression test.
- Update dashboard page titles to reflect the active project view.
- Add startup script save and pull workflows, settings editing, and startup script execution during workspace creation.
- Persist unsent chat drafts per session and cap composer height in the sessions chat panel.
- Auto-start ticket refinement sessions from the tickets board when create actions use a ticket template.
- Keep the new-session chat editor stable while typing and add an e2e focus regression test.
- Remove linked git worktrees when workspaces are deleted or archived.

#### @pstdio/ui `0.2.1` (`@pstdio/ui@0.2.1`)

- Add startup script save and pull workflows and settings editor support.
- Persist unsent chat drafts per session and cap composer height in the sessions chat panel.
- Keep the new-session chat editor stable while typing and add an e2e focus regression test.

### 2026-03-15

#### pstdio `0.1.5` (`pstdio@0.1.5`)

- Update Discord links to the current community invite URL.
- Fix untracked file diff stats for new files and resolve an SSE bootstrap race that could drop session status updates.
- Generate the `pstdio` package README from the root README during publish.
- Add router-agnostic `SidebarNext` and `SidebarTree` with persisted Zustand state and story coverage.

#### @pstdio/ui `0.2.0` (`@pstdio/ui@0.2.0`)

- Add router-agnostic `SidebarNext` and `SidebarTree` components with persisted Zustand state and story-driven behavior coverage.

#### pstdio `0.1.4` (`pstdio@0.1.4`)

- Fix project creation flow and sync delete handling in dashboard.
- Show model and repo selectors in workspace conversation chat.
- Fix dashboard ticket card session indicator to use session lifecycle status.
- Fix packaged project creation seeding in compiled binaries.

### 2026-03-13

#### pstdio `0.1.3` (`pstdio@0.1.3`)

- Fix dashboard root content-type response, duplicate GitHub releases, version script formatting, and lockfile sync behavior.

#### pstdio `0.1.2` (`pstdio@0.1.2`)

- Fix npm entrypoint failures under Node.js by switching to a CommonJS bin entrypoint.
