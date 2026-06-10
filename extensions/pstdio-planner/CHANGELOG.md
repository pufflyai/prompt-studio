# pstdio-planner

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
