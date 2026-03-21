# Changelog

Latest product updates.

---

## 0.1.7

**Date:** Upcoming
**Title:** pstdio 0.1.7 (unreleased)
**Tags:** unreleased

### Changes

- **Ticket file editing** — Enable ticket details to select, edit, and autosave attached ticket files with URL-synced file selection.
- **Dashboard tab titles** — Improve dashboard tab titles for deep project and template settings views.
- **Template type guards** — Guard template type updates and fallback invalid settings template routes.
- **Ticket status sync** — Sync local ticket file frontmatter when updating ticket status via CLI.

---

## 0.1.6

**Date:** Mar 17, 2026
**Title:** pstdio 0.1.6

### Changes

- **Empty template creation** — Allow creating project templates with empty content from dashboard settings and cover the flow with a UI e2e regression test.
- **Project view page titles** — Update dashboard page titles to reflect the active project view.
- **Startup scripts** — Add startup script save and pull workflows, settings editing, and startup script execution during workspace creation.
- **Chat draft persistence** — Persist unsent chat drafts per session and cap composer height in the sessions chat panel.
- **Auto-start refinement** — Auto-start ticket refinement sessions from the tickets board when create actions use a ticket template.
- **Stable chat editor** — Keep the new-session chat editor stable while typing and add an e2e focus regression test.
- **Worktree cleanup** — Remove linked git worktrees when workspaces are deleted or archived.

---

## 0.2.1

**Date:** Mar 17, 2026
**Title:** @pstdio/ui 0.2.1

### Changes

- **Startup script support** — Add startup script save and pull workflows and settings editor support.
- **Chat draft persistence** — Persist unsent chat drafts per session and cap composer height in the sessions chat panel.
- **Stable chat editor** — Keep the new-session chat editor stable while typing and add an e2e focus regression test.

---

## 0.1.5

**Date:** Mar 15, 2026
**Title:** pstdio 0.1.5

### Changes

- **Discord links** — Update Discord links to the current community invite URL.
- **Diff stats and SSE fix** — Fix untracked file diff stats for new files and resolve an SSE bootstrap race that could drop session status updates.
- **README generation** — Generate the pstdio package README from the root README during publish.
- **Sidebar components** — Add router-agnostic SidebarNext and SidebarTree with persisted Zustand state and story coverage.

---

## 0.2.0

**Date:** Mar 15, 2026
**Title:** @pstdio/ui 0.2.0

### Changes

- **Sidebar components** — Add router-agnostic SidebarNext and SidebarTree components with persisted Zustand state and story-driven behavior coverage.

---

## 0.1.4

**Date:** Mar 15, 2026
**Title:** pstdio 0.1.4

### Changes

- **Project creation fix** — Fix project creation flow and sync delete handling in dashboard.
- **Workspace chat selectors** — Show model and repo selectors in workspace conversation chat.
- **Session indicator fix** — Fix dashboard ticket card session indicator to use session lifecycle status.
- **Packaged seeding fix** — Fix packaged project creation seeding in compiled binaries.

---

## 0.1.3

**Date:** Mar 13, 2026
**Title:** pstdio 0.1.3

### Changes

- **Dashboard and release fixes** — Fix dashboard root content-type response, duplicate GitHub releases, version script formatting, and lockfile sync behavior.

---

## 0.1.2

**Date:** Mar 13, 2026
**Title:** pstdio 0.1.2

### Changes

- **Node.js entrypoint fix** — Fix npm entrypoint failures under Node.js by switching to a CommonJS bin entrypoint.
