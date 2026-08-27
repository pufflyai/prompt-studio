# pstdio-planner

## 0.12.0

_2026-08-27_

### Minor Changes

- f29a3c6: Expose planner status and tag settings updates through pst.
- d7a5b16: Move template content and editing workflows from core into owning extensions.
- d7a5b16: Move ticket templates and mutating command metadata into Planner.

### Patch Changes

- 5329cb7: Replace overlapping extension UI contracts with alpha.4 views, placements, navigation, and shared workflow statuses.
- 40e4fd6: Add provider-backed workspace creation.
- fb063d3: Remove the expected revision and manual review options from the run review command.
- 545d925: Pass command and middleware parameters as the second handler argument across the extension API.
- 545d925: Add stable workbench views and migrate extension navigation.
- 82138c3: Update the Bun toolchain requirement to 1.3.14.
- Updated internal dependencies: `@pstdio/sdk@0.21.0`, `@pstdio/ui@0.21.0`

## 0.11.2

_2026-08-25_

### Patch Changes

- Updated internal dependencies: `@pstdio/sdk@0.20.0`

## 0.11.1

_2026-08-24_

### Patch Changes

- 0c95890: Hide internal base guards from Run attempt.
- Updated internal dependencies: `@pstdio/ui@0.20.1`, `@pstdio/sdk@0.19.0`

## 0.11.0

_2026-08-21_

### Minor Changes

- b0457fc: Add explicit event-driven refresh contracts for native extension renderers.
- fcd283d: Let panels place every native renderer through one renderer reference.
- d34a989: Add attempt-aware implementation and review workflows with immutable revision history and recovery.

### Patch Changes

- e2b8668: rewrite documentation, skills, and templates in plain technical English
- 883e31b: Add explicit row activation callbacks for data table and Kanban renderers.
- 62e813b: Keep ticket breadcrumbs in sync after creates and renames.
- de6a77b: Version the extension API as `1.0.0-alpha.1` and refuse extensions that declare a different version or a range.
- 8b7adf9: Declare Planner and Extension Lab composition with resource kinds, slots, and mode recipes, and move the Lab status bar to a typed status item
- 8b7adf9: Open the Tickets browse-root resource from the planner tree item
- 7cb9939: Replace renderer-owned command bindings with private callbacks.
- 8b7adf9: Preserve editable file drafts, focus, and revision-aware refreshes across save and recovery.
- 4dc237f: Share renderer invocation context contracts across first-party renderers.
- fcd283d: Restore the Tickets breadcrumb root and let tree items opt out of the Extensions group with `group: null`.
- 054f954: Add an archive-state filter to the ticket board.
- 7c538c9: Unify extension navigation targets and placement strategies.
- 62aedfb: Make composition the sole owner of panel placement and expose placement-aware panel queries.
- Updated internal dependencies: `@pstdio/sdk@0.18.0`, `@pstdio/ui@0.20.0`

## 0.10.0

_2026-08-13_

### Minor Changes

- 5e57bf7: Let extensions contribute their own settings sections through a `settingsSections` contribution that panels opt into with `section`, and group the planner's Ticket status and Ticket tags panels under a Planner section; adopt status ring and level bar glyphs as the default status and tag icons
- 5e57bf7: Rebuild the tag editor as flat hairline rows with a combined colour/icon swatch, an appearance popover carrying status ring and level bar glyphs from the new prompt-studio-icons font, inline renaming of tag definitions, a shared segmented control, and one header save bar per settings screen that marks unsaved edits and offers Reset
- b4daee0: Add explicit, non-overwriting change request and review report workflows with no default report template.

### Patch Changes

- 0cfd2c8: Persist Side Panel tabs, presentation, session selection, and chat drafts while showing ticket workspace sessions.
- f924ca2: Show the created-at date in the ticket properties panel next to the updated-at date
- 6603da2: Show the latest workspace session status on ticket cards and open that session in the Side Panel from the workspace badge indicator
- 78e3af9: Keep first-party extension UI dependencies aligned with the host UI package
- Updated internal dependencies: `@pstdio/sdk@0.17.0`, `@pstdio/ui@0.19.0`

## 0.9.0

_2026-08-04_

### Minor Changes

- 135aaf4: Show ticket ancestry and add immediate-parent filtering

### Patch Changes

- Updated internal dependencies: `@pstdio/ui@0.18.0`

## 0.8.0

_2026-07-28_

### Minor Changes

- fdec3b2: Derive ticket and workspace breadcrumbs from canonical hierarchy edges with atomic linked-resource history.
- 43a57b9: Rename the data renderer API to kanban renderer and adopt the saved-view Kanban design.
- da4ea62: Keep global collections persistent and show selected-resource trees in the Sidenav
- 336b8be: Place resource actions beside rows and selected breadcrumbs
- da4ea62: Rename Sidebar to Sidenav and add persistent Sidenav visibility and ordering
- d5455b0: Render create forms from the full param vocabulary and the resource's own editable attributes: add markdown and files field types, localize field and chrome copy, and reject unsupported param types instead of dropping them.
- b4b601b: Unify Workbench panel authoring, presentation, navigation, and persistence APIs
- 2cd0050: Extract planner automation into a repository extension and derive work activity from live sessions.
- 9c5337a: formalize extension roles and persist project-scoped workbench navigation

### Patch Changes

- 39de767: Restore ticket interactions and settings, add renderer-owned create forms, and refresh local extension modes.
- f0c6bbf: Fix OpenCode skill status guidance and interactive question responses
- 73bc10c: Preserve mode-owned layouts while switching panels without resetting project chrome.
- aaf9e96: Match the canonical desktop workbench geometry and migrate layout contracts to Region terminology
- 8d7d899: Rename the default "Ready" board status to "TODO" and color it purple
- Updated internal dependencies: `@pstdio/ui@0.17.0`, `@pstdio/sdk@0.16.0`

## 0.7.0

_2026-07-09_

### Minor Changes

- bdfaf8d: Render the ticket properties panel as a native controls renderer: status and tags edit inline, while parent, dependencies, and review links show as resource tags.

### Patch Changes

- ab0193c: Rename bundled core extensions to Prompt Studio labels and stabilize provision hooks.
- 1597b7c: Add workspace reports for agent handoff artifacts.
- fb92ea5: Persist planner archive-all ticket updates before linked workspace cleanup, and report cleanup failures via a persistent notification so a failed cascade no longer rejects the archive command.
- dcd55b6: Make Knip dependency and export checks actionable
- 51d5a3f: Remove the workspace-level artifact directory from the implement-ticket skill guidance.
- 879312c: Add a React xterm.js terminal surface (shipped as `@pstdio/ui/terminal`): a high-level `<Terminal />` component plus a lower-level `useTerminalSession` hook for advanced webviews, consuming the `terminal.session` bridge surface.

  Update planner extension button variants for the current Chakra UI recipe surface.

- Updated internal dependencies: `@pstdio/ui@0.16.0`, `@pstdio/sdk@0.15.0`

## 0.6.0

_2026-06-28_

### Minor Changes

- aec472d: Add durable notification center and inbox workflows.

### Patch Changes

- aec472d: Fix notification review actions, extension attribution, and merge completion handling.
- 21d7d58: Allow tree views to opt into host header and footer rows.
- 56fd893: Keep ticket sidebar files and workspaces fixed.
- 56fd893: Show the open ticket's anchored sessions (Refine ticket, Break into sub-tickets, Run attempt) in a new Sessions section of the ticket-mode sidebar, opening each in the floating session panel
- 21d7d58: Ticket sidebar: render empty Files, Workspaces, and Sessions sections as disabled icon-bearing placeholder rows.
- 56fd893: Drop the `default-` prefix from seeded ticket status ids (`backlog`, `ready`, `in-progress`, `blocked`, `in-review`, `done`) so the raw status id reads cleanly for API and LLM consumers
- 149410f: Differentiate single and multi-select tag controls.
- 02a9000: Point implement-ticket run proofs at workspace-level artifacts.
- Updated internal dependencies: `@pstdio/ui@0.15.0`, `@pstdio/sdk@0.14.0`

## 0.5.4

_2026-06-23_

### Patch Changes

- d2cea90: Keep refreshed resource placements self-consistent and derive planner titles from visible markdown text.
- 40c2ebb: Parse ticket frontmatter delimiters only when they appear on their own line.
- cc229d5: Persist manual ticket ordering after planner board drag-and-drop.
- b51460e: Fix `tickets save` failing with `Unknown ticket ""` when a ticket's frontmatter has an empty `parent_id`.
- 36487b3: Use outline and primary button variants instead of solid buttons.
- Updated internal dependencies: `@pstdio/ui@0.14.0`, `@pstdio/sdk@0.13.2`

## 0.5.3

_2026-06-17_

### Patch Changes

- d8383a9: Add provider-neutral review links to planner tickets.
- d8383a9: Archive all now archives every ticket in the selected planner column.
- Updated internal dependencies: `@pstdio/ui@0.13.0`

## 0.5.2

_2026-06-16_

### Patch Changes

- 2cbc762: Resolve archive and delete ticket actions from resource context.
- 2cbc762: Show ticket names in the planner files tree.
- 2cbc762: Refresh ticket properties when tag icons change
- 2cbc762: Prevent planner ticket breadcrumbs from looping on circular parent chains.
- 2cbc762: Fail ticket updates for unknown ticket ids.
- 2cbc762: Rewrite the planner ticket skills around the real model: tickets are planner extension resources driven by `pst tickets …` (the same commands as the dashboard board and command palette), not a "legacy CLI". Drops the false legacy/planner-resource dichotomy, makes the CLI the primary path with the `write`/`pull` → edit → `save` draft loop, aligns the skills with the ticket templates (priority/type are tags, acceptance lives in the template), corrects the stale flags in the pstdio CLI reference, and aligns the lab skill's folder/name identity.
- 2cbc762: Nest ticket-linked workspace breadcrumbs under the planner ticket ancestry.
- 28b38cb: Let extension settings panels declare a sidebar `icon`; default to `Sliders` when omitted, and set `list-checks`/`tag` on the planner's status and tag panels.
- 42aff47: Move the workspace run review action into the overflow menu.
- 2cbc762: Fix main-left ticket workspace creation prompts.
- 42aff47: Route planner ticket details through a resource-owned sidebar mode
- 2cbc762: Fix skill SKILL.md frontmatter so `metadata` is a map; the previous sequence form was rejected by the Codex and Claude Code skill loaders.
- 2cbc762: Use circle icons for planner statuses and complexity tags.
- 42aff47: Sort planner tickets by created date by default.
- 42aff47: Sort planner tickets by created date by default.
- 2cbc762: Copy planner ticket files into newly created worktrees.
- Updated internal dependencies: `@pstdio/ui@0.12.2`, `@pstdio/sdk@0.13.1`

## 0.5.1

_2026-06-15_

### Patch Changes

- 5f60df8: Sort ticket boards by latest update by default.
- 5f60df8: Use ticket shorthands when refining planner tickets.
- 5f60df8: Fix planner ticket sidebar sections, board actions, workspace menus, placeholders, and diff badges.
- 5f60df8: Support multi-select tag changes from ticket card badges.
- Updated internal dependencies: `@pstdio/ui@0.12.1`

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
