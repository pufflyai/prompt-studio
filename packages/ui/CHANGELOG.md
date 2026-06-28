# @pstdio/ui

## 0.15.0

_2026-06-28_

### Minor Changes

- aec472d: Add durable notification center and inbox workflows.

### Patch Changes

- 21d7d58: Give data renderer board column headers a consistent height regardless of whether they have action buttons, and remove the gap between the header and its cards
- aec472d: Fix notification review actions, extension attribution, and merge completion handling.
- 21d7d58: Data renderer: group rows whose status was removed under the "no status" column instead of a stranded orphan column
- 7c50105: Render Mermaid diagrams with the active app theme
- 56fd893: Share searchable modal chrome across dashboard overlays
- 21d7d58: Use small default buttons, xs input radii, and flat xs-radius session bubbles.
- 21d7d58: Align dashboard sidebar sizing and remove disabled button hover styling.
- 02a9000: Align data renderer filter menu styling, overlay radii, and workspace list context menus.
- 21d7d58: Use compact chat input corners and hide empty attachment tray.
- 21d7d58: Reduce sidebar project menu button sizing.
- 21d7d58: Tighten described list row spacing
- 02a9000: Use the xs border radius for menu surfaces to match popovers.
- 56fd893: Set tooltip border radius to xs.
- 56fd893: Use list rows in the diff viewer options menu
- 907869e: Markdown editor now respects user font scaling (45rem content column) and applies live markdown shortcuts while editing.
- 21d7d58: Keep portalled searchable menus above dialog overlays.
- 149410f: Differentiate single and multi-select tag controls.
- 02a9000: Keep scrollbars above layered row content
- 21d7d58: Sidebar project control is now two standard sm ghost buttons: the project label activates project mode, and a chevrons-up-down affordance opens the project selector.
- 21d7d58: Remove shadow styling in favor of border highlights
- 56fd893: Make data renderer filters checkbox multi-select and selected dropdown rows use checkmarks.
- 02a9000: Render tree empty states as compact placeholder rows.
- 21d7d58: TreeList customization is now explicit: sections and rows opt in to the hide/show menu via canHide (off by default), and the menu builder accepts header/body/footer regions. Categories, header/footer rows, and opted-in top-level body rows (e.g. a "Tickets" nav entry) are hideable; leaf sub-items never are. Adds filterVisibleNodes for flat header/footer lists.
- 21d7d58: Tune theme + data renderer styling (xs button radius, 2xs modal + menu radius, bordered command palette, no modal shadow, modals clipped with overflow hidden, xs card radius, smaller board column title) and show eye/eye-off plus the item icon (and a separated reset row) in the tree and tab visibility menus
- 21d7d58: Hide empty tree and tab visibility menus
- 21d7d58: Show data renderer sorting as Sort by with directional A-Z/Z-A icons, and list dashboard workspaces oldest-first by default.

## 0.14.0

_2026-06-23_

### Minor Changes

- 30a514e: Remove obsolete chat agent runtime types from the UI package, narrow `SessionMessagePart` to the canonical API contract shape, and expose UI-only alerts through `ChatMessagePart`.

  Downstream chat-ui consumers that previously rendered alert parts from `SessionMessagePart[]` should type those rendered parts as `ChatMessagePart[]` instead.

  Use a repo-level Bun test preload for Lexical peer packages so `@lexical/markdown` initializes deterministically during validation.

### Patch Changes

- 7d4e231: Render shortcut modifier indicators with user-facing labels.
- 36487b3: Fix primary button text color in light and dark modes.
- 0ca1dca: Fix session attachments: agents now read images as images (extension-correct path), image previews render on sent messages, attachment bubbles sit inside the chat input, draft removal works, and conversation loading no longer crashes on sparse message patches.
- aa22c92: Show old and new image previews in workspace diffs.
- 7dee8b3: Improve Mermaid diagram preview controls and PNG export.
- cc229d5: Persist manual ticket ordering after planner board drag-and-drop.
- 7dee8b3: Harden the Mermaid renderer: switch to `antiscript` security level, repair the SVG XML so HTML labels render in `<img>`, and keep the fullscreen diagram inside the surface.
- 36487b3: Use outline and primary button variants instead of solid buttons.
- aa22c92: Limit image diff preview payloads, ignore invalid image preview sources, and map image files to the Seti image icon.
- 0ca1dca: Add prototype session attachments across CLI, dashboard, API queueing, and harness dispatch.
- 7d4e231: Standardize workbench shortcut defaults around safe cross-platform chords; the command palette now opens with `Mod+K`, and the extension runtime warns when contributions use browser, OS, or developer-tool reserved chords.
- 7a0f4e1: Fix chat session chrome and modal overlay regressions.
- 94a7c37: Fall back to a default theme when the stored theme preference is an unknown legacy id, instead of leaving the app blank waiting for it to register.
- 122d117: Bundle the internal file-type helper into the UI package.

## 0.13.0

_2026-06-17_

### Minor Changes

- d8383a9: Extensions can contribute file icon themes that render in workbench file trees. New `pstdio-base-themes` extension ships Monokai, Solarized Light/Dark, Dracula, and the Seti file icon theme (the default for file trees); appearance themes/icons were removed from `extension-lab`. The theme picker now groups entries by light/dark.

### Patch Changes

- d8383a9: Improve recent sessions start page rows.
- d8383a9: Fix nested buttons in rows with inline actions
- d8383a9: Preserve selected extension themes after refresh
- d5cbc8f: Preserve extension user data: a missing source no longer prunes a data-bearing install, the instance foreign keys now restrict instead of cascade, and uninstall keeps data by default with an explicit opt-in to delete it.
- d8383a9: Align default dark badge surfaces with backgrounds
- d8383a9: Align chat, diff, avatar, badge, tag, and Monaco editor colors with active theme tokens.

## 0.12.2

_2026-06-16_

### Patch Changes

- 2cbc762: Refine workbench theme chrome and session bubble borders.
- 2cbc762: Show workspace badges for data-renderer display properties.

## 0.12.1

_2026-06-15_

### Patch Changes

- 5f60df8: Fix editable data renderer tag menus and clear selection handling.
- 5f60df8: Fix planner ticket sidebar sections, board actions, workspace menus, placeholders, and diff badges.
- 5f60df8: Allow data renderer badges to edit enum properties.
- 5f60df8: Avoid bundling unused dashboard icons and fix menu item ARIA roles

## 0.12.0

_2026-06-14_

### Minor Changes

- 989ffbe: Show linked workspace badges with diff totals on ticket board cards.

## 0.11.0

_2026-06-11_

### Minor Changes

- fcc68a9: Show ticket tag and status icons on cards (tinted icon instead of a colored badge background) and make those icons editable from the tag and status settings panels.
- fcc68a9: TreeList gains a back-of-tree right-click customization menu (`backgroundContextActions`) and a per-node `canHide` opt-out for hiding/showing tree entries.
- 0eb5c57: Make TagSettingsPanel host-controlled so planner extension views own React Query loading, saving, and cache invalidation.

### Patch Changes

- fcc68a9: Make extra small buttons shorter.
- fcc68a9: Render read-only param editor values as property rows.
- fcc68a9: Move planner-owned translations into the planner extension and capitalize Harness terminology.
- fcc68a9: Match light panel backgrounds to the default background
- fcc68a9: Add resource-aware context menus for tree rows.
- fcc68a9: Add agent-focused Storybook documentation for UI usage.
- fcc68a9: Keep data renderer list tags and group expansion state consistent

## 0.10.0

_2026-06-09_

### Minor Changes

- ca7222b: Upgrade data renderers with schema-driven attributes, live option colors, custom empty states, list grouping controls, row actions, and dashboard bridges for extension-backed boards.
- e887758: TagSettingsPanel now loads and saves through react-query; consumers must render it inside a QueryClientProvider and pass a `queryKey`.
- ca7222b: Rename the status option editor to a generic tag editor
- ca7222b: Add ticketless and default workspace flows, workspace status automation settings, worktree setup helpers, and CLI/API create and delete support.

### Patch Changes

- ca7222b: Add editable size variants to the UI theme.
- 6de1f50: Add a shared workbench extension host for testbench previews.
- e887758: Simplify diff viewer empty and loading states.
- 967c041: Fix large diff file tree navigation alignment
- 6f35233: Add a command palette resource provider API: extensions contribute dynamic, searchable palette results via a queryCommand instead of static command entries.
- ca7222b: Clean up data renderer live option refresh handling
- e887758: Improve dark mode command palette hover contrast.
- 900909c: Make session navigation pick the active or latest session and render static breadcrumbs as non-clickable.
- 6f35233: Align dark panel background with primary background.
- e887758: Keep command palette hover and keyboard selection to one active row.
- e887758: Tickets: add multiple editable files per ticket, shown in a Files tree in the main-left panel beside the editor (create/delete/select, with file selection coordinated over the extension command feed), and make the per-status board actions (create ticket / drag in / drag out / archive all) configurable from the ticket status settings. `TagSettingsPanel` now forwards `actionOptions`/`actionsColumnLabel` to the underlying editor.
- ca7222b: Fix workspace visibility, ticket creation, and settings panel regressions
- ca7222b: Move the dashboard onto the workbench runtime with project navigation, sessions, settings, workspace detail views, command palette actions, and persisted panel state.
- ca7222b: Polish command palette focus colors, sidebar tree reloads, diff loading states, resource icons, side-panel onboarding, shared control behavior, and extension lab layout styling.

## 0.9.0

_2026-06-01_

### Minor Changes

- f6ec9d8: Replace the ticket-shaped data renderer with a declarative, schema-driven attribute system (enum/enum-multi/string/date/number/user) whose options can be reactive sources, migrate the workbench data views and persisted store state to it, and drop saved views/favorites.
- f6ec9d8: Move the bundled Monokai theme into extension lab and map VS Code / extension theme tokens into workbench app tokens.
- f6ec9d8: Move workspace status management into the workspace automations extension with a shared status option editor (icon/color picking).

### Patch Changes

- f6ec9d8: Add the core tickets extension with bundled ticket skills and templates.
- f6ec9d8: Introduce the dashboard workbench: project selection/creation/switching, workspace and session views, date-grouped session sidebar, breadcrumb trail, workspaces board, changes/checks panels (with binary/image diff placeholders), command palette and keyboard shortcuts, help menu, in-workbench project settings including per-attempt-status icons, a host-owned toast viewport, and persisted tree/panel/last-resource state.
- f6ec9d8: Improve data renderer list group counts, expansion toggles, and drop targets.
- 9b84ce8: Run Chakra type generation before building the UI package.
- f6ec9d8: Improve shared UI controls: command palette keyboard navigation and focus, arrow-key navigation for tree lists, anchored chat input, breadcrumb separator spacing, and extension SDK authoring types.

## 0.8.0

_2026-05-20_

### Minor Changes

- e03b790: Rename `TicketsWorkspace` → `DataRenderer` and align all related symbols/files with the data-renderer abstraction. Component renames: `TicketsWorkspace`/`TicketBoard`/`TicketList`/`TicketCard` → `DataRenderer`/`DataRendererBoard`/`DataRendererList`/`DataRendererCard`. Type renames: `WorkspaceTicket`/`WorkspaceSettings`/`WorkspaceTagDefinition`/`WorkspaceOption`/`WorkspaceFilterCategory`/`FilterState`/etc → `DataRendererRow`/`DataRendererSettings`/`DataRendererTagDefinition`/`DataRendererOption`/`DataRendererFilterCategory`/`DataRendererFilterState`/etc. Hook: `useTicketsWorkspaceStore` → `useDataRendererStore`. File paths moved from `components/tickets/` to `components/data-renderer/`. Field-concept names (`GroupingField`, `OrderingField`, `DisplayProperty`, `ViewMode`) and prop field names (`tickets`, `onTicketClick`, etc.) stay unchanged.
- e03b790: Add workbench collections primitives

## 0.7.1

_2026-05-17_

### Patch Changes

- b8c09bd: bump mermaid from 11.14.0 to 11.15.0

## 0.7.0

_2026-05-16_

### Minor Changes

- 2fa3aa2: Add native extension theme and file icon theme contribution support.

### Patch Changes

- 8366f27: Estimate diff card heights from rendered line counts and remove the redundant diff body mount/unmount.
- 1465bb8: Add reusable virtualized palette component
- cb8b2d1: Virtualize chat panel message rendering.
- ebc2c7f: Use a shared performant splitter with collapsible dashboard panels.
- cb8b2d1: Show chat loading state before session messages hydrate.
- c256713: Replace project settings plugins with installed extension metadata.
- 2fa3aa2: Align file tree icon spacing with internal row icon sizing.
- 8366f27: Make ParamEditor rows more compact.
- 8366f27: Add split and unified layout options to the diff viewer menu.
- 8366f27: Improve diff viewer performance with virtualized file tree rows and tighter initial diff rendering.
- 48ba104: Improve dashboard route workbench performance
- 8d57ab1: Fix diff drawer header stacking and Storybook drawer width.
- 8366f27: Improve the diff viewer menu and expand/collapse behavior.
- 8366f27: Replace the repo picker file browser with an inline searchable list.
- 8d57ab1: Skip rendering oversized file diffs by default in the shared diff drawer.
- 8366f27: Use property params instead of a separate ParamEditor items API.
- 1cdb3c0: Show queued sessions with the queued status icon.
- 7fe76bc: Fix chat panel spacing, breadcrumb wrapping, and responsive ticket properties layout.
- 2f5fbad: Restore diff loading and keep interactive diff expansion while hiding only truly large diffs.
- e3693cb: Add the private pstdio-workbench package and workbench foundation APIs.
- 4e73f2e: Add hover actions with copy and timestamp metadata for assistant chat messages.
- 8366f27: Polish integration cards, breadcrumbs, and simple workspace tabs.
- 709dfc6: Make markdown and tool-rendered checklist items more compact.
- cb8b2d1: Make navigating between the project panels feel instant even with hundreds of sessions and many tickets.

  - `Sidebar` gains an opt-in `virtualize` prop that virtualizes the inner `TreeList` rows via `@tanstack/react-virtual`; the sessions sidebar opts in to keep render cost flat as session count grows.
  - The sessions panel defers mounting the heavy `SessionChatView` subtree one frame after the panel chrome paints.
  - The tickets panel renders its chrome immediately (no more blocking "Loading…" gate) and defers the heavy board view one frame so back-navigation from sessions/workspace feels instant.
  - The project workbench narrows `useRouterState` to a `location` selector so it does not re-render on unrelated router state changes.

- b04d6cf: Hide user message copy actions until the message is hovered or focused.

## 0.6.0

_2026-05-10_

### Minor Changes

- 8adca2c: Add activity components and align semantic UI theme tokens.

### Patch Changes

- 990b414: Cancel rich text link edits when selection leaves the link.
- eb2f9f4: Fix markdown editor escaping underscores during save/reload, which broke links over multiple round-trips.
- 990b414: Connect the link editor plugin in the markdown editor and add a link button to the floating edit bubble for inserting and removing inline links.
- 990b414: Fix rich text link editor positioning and URL validation.

## 0.5.2

_2026-05-07_

### Patch Changes

- f394c6a: Tune list, menu, input, and scrollbar chrome
- 5c5d634: Promote `KnownAgent`, `findAgent`, `KNOWN_AGENTS`, `KNOWN_AGENT_IDS`, and `isKnownAgentId` from `pstdio-agents` into `pstdio-api-contracts` so UI and storage layers no longer depend on the runtime LLM package.

## 0.5.1

_2026-04-29_

### Patch Changes

- 41f858d: Bound multiline sticky user messages with scroll handoff
- 92ce38e: Handle OpenCode question/todowrite UI support and make plugin command execution honor local PATH.
- f8edf81: Fix OpenCode question replies getting stuck and stale question prompts remaining visible.
- 92ce38e: Reduce xs button icon sizing in the shared Chakra recipe.
- 084969c: Fix ticket workspace grouping menus, filtered columns, list drag-and-drop, and list indentation.

## 0.5.0

_2026-04-24_

### Minor Changes

- f86d12b: Add Mermaid block preview and inline editing support in rich text markdown editors.
- 73e707e: Improve markdown editor code block authoring with inline editing, block insertion, and copy actions.
- 7676e4b: Allow dashboard users to stop active sessions from the chat composer.
- 000bdcb: Replace labels with tags system and add inline tag editing via badge dropdowns

### Patch Changes

- d9c5cd4: Add a sidebar action to create empty workspaces without starting a session and preserve workspace-only hook coverage
- ed09ec7: Add right-click resource context menus for ticket cards, workspace items, and session items using shared header action composition so default and plugin actions stay consistent with dialog, pending, and disabled behavior.
- 582bcae: Tune rich text spacing across the editor and blog
- 808e50b: Fix Claude Code tool timeline rendering so existing tool renderers resolve reliably and Edit and TodoWrite render with structured output.
- 948be5a: Fix ticket workspace grouping columns and trim default display fields.
- d0abed3: Fix markdown editors so nested list items render correctly from markdown and can be indented with Tab.
- 54f69cb: Add a centralized dashboard shortcut registry with project-level handlers, shortcut help, and shared menu shortcut labels
- 95e20be: Fix markdown bubble menu visibility so it only appears for non-collapsed text range selections.

## 0.4.0

_2026-04-17_

### Minor Changes

- 5dc9d76: Add checklist (todo item) support to MarkdownEditor
- b01f555: Rename SidebarNext to Sidebar, remove PanelMenu, and refresh @pstdio/ui accent tokens

### Patch Changes

- b01f555: Set selected text in dark mode to use `fg.inverted` for better contrast on accent highlights.
- b01f555: Refresh the orange theme palette for clearer warning states.
- b01f555: Use consistent sidebar header padding on both axes.
- b01f555: Restore semantic sidebar icon colors for session status rows.
- 013310f: Fix OpenCode session timeout and restart recovery: separate provider-managed lifecycle from activity-managed lifecycle and add disconnected session status
- b01f555: Extract reusable bubble and attached panel shells into @pstdio/ui and keep the attached panel mounted across layout-story navigation.
- e242254: Improve shared searchable menus for parent-child list switching and clearer browser headers.
- 62d3854: Highlight both the workspace and its active session in the ticket sidebar
- f21a710: Improve workspace diff loading, file navigation, and sidebar planning navigation cues
- b01f555: Add 1px spacing between sidebar tree items.
- c9a2e69: Fix bare URLs rendering as clickable links in rich messages.
- b01f555: Fix sidebar layout sizing and align panel header heights.
- 3a77d88: Render the project settings skill viewer with a file tree (icons + folders) and move the skill title and description above the editor so they align with its width. On startup, also auto-sync existing project skills that still hold a single SKILL.md file with the latest bundled multi-file skill (when the SKILL.md content is unchanged), and reinstall them to repos.
- b01f555: Reduce the sticky user message collapsed max height in chat sessions so pinned prompts consume less vertical space.
- b01f555: Make attached session panels resizable in the dashboard and shared UI shell.
- 2eaa0b3: Replace ticket workspace/session indicators with a unified workspace badge, including attempt-status tooltip support and sidebar/board integration.
- b01f555: Add a reusable sidebar project menu and update the layout story to match the app shell.
- 3dd7a83: Fix local workspace docker runs and improve long error toasts.
- b01f555: Refine UI surface and border tokens for the updated neutral palette.
- b01f555: Adjust dark active background color to better match the shared theme.
- b01f555: Move the version entry from the shared sidebar project menu into the dashboard Help menu.

## 0.3.1

_2026-04-06_

### Patch Changes

- 1d384f8: Replace the background permutation story with a surface composition story for buttons, menus, and modals.
- 1d384f8: Align TypeScript dependency ranges to ^5.9.3 across workspace packages.

## 0.3.0

_2026-04-03_

### Minor Changes

- 8b565f0: Release the updated @pstdio/ui dependency contract.

## 0.2.5

_2026-03-27_

### Patch Changes

- 47b5f7a: Keep ticket cards within kanban column bounds by wrapping long unbroken title strings and add Storybook coverage for URL-like tokens.
- 8eaf4ac: Add a shared searchable menu for hooks and repo branch selection.
- 8eaf4ac: Add a token usage story for the chat message parts renderer.

## 0.2.4

_2026-03-24_

### Patch Changes

- 8b04ba9: Show a workspace diff hub above session chat inputs for workspace-backed sessions.
- abadf39: Replace read-only Monaco diff surfaces with git-diff-view and add adapter coverage tests.
- 8b04ba9: Replace the session chat empty state with a reusable chat skeleton and unavailable-session fallback.

## 0.2.3

_2026-03-22_

### Patch Changes

- e6a54d3: Improve collapsed sticky user message: shorter height, no scroll, overlay show-more button, stays floating when expanded
- 05705ba: Use ScrollArea for rich-text content editable scrolling.

## 0.2.2

_2026-03-20_

### Patch Changes

- 7289bdd: Improve chat message spacing and add scroll-area handling for rich messages and chat input.
- c88802f: Add a configurable TicketsWorkspace with persisted display settings, filtering controls, and ticket grouping utilities.

## 0.2.1

_2026-03-17_

### Patch Changes

- 79285d3: Add startup script save/pull workflows and settings editor
- cad7cc9: Persist unsent chat drafts per session and cap composer height in the sessions chat panel.
- de3bae4: Keep the new-session chat editor stable while typing and add a sessions e2e regression test that verifies focus is retained across consecutive keystrokes.

## 0.2.0

_2026-03-15_

### Minor Changes

- a3cfc65: Add router-agnostic SidebarNext and SidebarTree components with persisted zustand state and story-driven behavior coverage.

## 0.1.1

_2026-03-13_

### Patch Changes

- 08be990: Add optimistic follow-up messaging and keep chat input focused after send.

## 0.1.0

_2026-03-11_

### Minor Changes

- 5134866: Initial release
