# pstdio-planner

## 0.5.0

_2026-06-14_

### Minor Changes

- 989ffbe: Show linked workspace badges with diff totals on ticket board cards.

### Patch Changes

- 989ffbe: Fix ticket properties dependency badges and updated-at display.
- Updated internal dependencies: `@pstdio/sdk@0.13.0`, `@pstdio/ui@0.12.0`

## 0.4.0

_2026-06-11_

### Minor Changes

- fcc68a9: Grow the new-ticket editor to fill the modal, drop its border, and render attachments as removable badges with an on-click image preview.
- fcc68a9: Render ticket content with the native file renderer instead of a webview, fixing slow ticket load. The ticket stays a single navigable resource: the files tree selects the body, a ticket file, or an image attachment, and the editor swaps that document in place (Markdown, Monaco, or read-only image) while the tree and properties panel stay mounted.
- fcc68a9: Show ticket tag and status icons on cards (tinted icon instead of a colored badge background) and make those icons editable from the tag and status settings panels.

### Patch Changes

- fcc68a9: Use project shorthand when allocating planner ticket IDs
- fcc68a9: Render read-only param editor values as property rows.
- fcc68a9: Add a default "Complexity" ticket tag (Simple/Moderate/Complex).
- fcc68a9: Move planner-owned translations into the planner extension and capitalize Harness terminology.
- fcc68a9: Drop the shorthand prefix from ticket card titles and label the file rename dialog's confirm button "Save".
- fcc68a9: Run attempt always starts a session; remove the optional start-session toggle.
- fcc68a9: Preserve ticket file extensions when renaming ticket files.
- fcc68a9: Carry ticket metadata on ticket-linked workspace resources so opening a workspace from a ticket nests its breadcrumb under Tickets / Ticket / Workspace.
- fcc68a9: Add a create workspace action to ticket Workspaces sections and start that section expanded.
- fcc68a9: Show ticket Workspaces empty states and reopen default tree sections when ticket views start.
- fcc68a9: Default newly added planner statuses to non-creatable.
- 0eb5c57: Make TagSettingsPanel host-controlled so planner extension views own React Query loading, saving, and cache invalidation.
- Updated internal dependencies: `@pstdio/sdk@0.12.0`, `@pstdio/ui@0.11.0`

## 0.3.0

_2026-06-09_

### Minor Changes

- d37d82b: Add the ticket draft workflow (`write`/`save`/`pull`/`files`), `implement`, `update-when-attempt-status`, and workspace/worktree listing as planner extension commands backed by extension storage and the host file/session/workspace primitives. Registered with `tickets …` CLI aliases (dormant until core dispatch is made generic).
- 6de1f50: Merge core planning extensions into pstdio-planner and rename worktree setup.
- 6de1f50: Add command-backed extension tree renderer contributions.
- d37d82b: Move a ticket into the in-progress column automatically when a session starts for its workspace (new `session.started` hook). Best-effort and idempotent — a ticket already in progress, a missing ticket, or a project without an in-progress column is left untouched.
- 6de1f50: Split shared pstdio skills into a dedicated default extension.
- e887758: Tickets: add multiple editable files per ticket, shown in a Files tree in the main-left panel beside the editor (create/delete/select, with file selection coordinated over the extension command feed), and make the per-status board actions (create ticket / drag in / drag out / archive all) configurable from the ticket status settings. `TagSettingsPanel` now forwards `actionOptions`/`actionsColumnLabel` to the underlying editor.
- ca7222b: Make the planner extension own ticket storage, board rendering, CRUD actions, create modal, markdown editor, status settings, tags, and detail properties.
- e887758: Render ticket properties in the workbench right sidepanel with the properties editor, edit tags there, and derive the ticket title from the start of the body instead of a separate input. Give default tags real icons, render them in the create modal and properties panel, and make the create-ticket modal shorter.
- ca7222b: Add ticketless and default workspace flows, workspace status automation settings, worktree setup helpers, and CLI/API create and delete support.

### Patch Changes

- 6de1f50: Add explicit extension command palette contributions
- e887758: Polish the create ticket modal editor, tag selector flow, and hosted modal sizing.
- 6f35233: Update bundled skills and prompts for pst command usage and extension ticket workflows.
- 6f35233: Add prompted rename actions for planner ticket files.
- ca7222b: Fix file picker cancellation and autosave flush ordering
- 900909c: Archiving a ticket now archives its workspaces; setting a workspace status no longer re-runs its automation when unchanged; status/tag reorder and a real workspace-status default persist; and ticket links are derived from generic resource anchors.
- 6f35233: Update planner default ticket statuses and board display properties.
- 8891110: Restore planner ticket workspace creation, bulk ticket reads, review automation failures, status caches, and image attachments.
- 0fcf801: Show ticket-linked workspaces in the ticket sidebar, sort them by latest workspace activity, and make file/image selection explicit
- 6f35233: Add a command palette resource provider API: extensions contribute dynamic, searchable palette results via a queryCommand instead of static command entries.
- 6de1f50: Use ticket shorthands in run attempt prompts from ticket row actions.
- ca7222b: Use the generic tag editor in settings panels
- e887758: Use the component icon for ticket resources.
- 0fcf801: feat(PS-35): render parent/depends-on as resolvable ticket links in the properties panel; add a read-only image-attachment preview in ticket mode (PS-36)
- 900909c: Show the ticket icon for tickets listed in the command palette.
- e887758: Expose ticket run, refine, and breakdown actions from ticket board row menus.
- 8891110: Remove legacy backend ticket tables and restore planner-owned ticket workflow automation.
- ca7222b: Fix workspace visibility, ticket creation, and settings panel regressions
- 900909c: Use ticket shorthands in planner ticket commands
- 900909c: Preserve workspace context for header/session actions and expose session resources to extensions.
- Updated internal dependencies: `@pstdio/sdk@0.11.0`, `@pstdio/ui@0.10.0`

## 0.2.0

_2026-06-01_

### Minor Changes

- f6ec9d8: Add the core tickets extension with bundled ticket skills and templates.
- f6ec9d8: Replace the legacy project-local automation system with an extension platform: user/repo extension discovery and load scopes, first-class extension settings, extension-provided mode layouts, host-owned workbench target attachments and header actions, hot reload, and SDK workbench/ticket APIs.

### Patch Changes

- Updated internal dependencies: `@pstdio/sdk@0.10.0`
