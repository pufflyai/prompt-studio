# @pstdio/ui

## 0.5.2

### Patch Changes

- f394c6a: Tune list, menu, input, and scrollbar chrome
- 5c5d634: Promote `KnownAgent`, `findAgent`, `KNOWN_AGENTS`, `KNOWN_AGENT_IDS`, and `isKnownAgentId` from `pstdio-agents` into `pstdio-api-contracts` so UI and storage layers no longer depend on the runtime LLM package.

## 0.5.1

### Patch Changes

- 41f858d: Bound multiline sticky user messages with scroll handoff
- 92ce38e: Handle OpenCode question/todowrite UI support and make plugin command execution honor local PATH.
- f8edf81: Fix OpenCode question replies getting stuck and stale question prompts remaining visible.
- 92ce38e: Reduce xs button icon sizing in the shared Chakra recipe.
- 084969c: Fix ticket workspace grouping menus, filtered columns, list drag-and-drop, and list indentation.

## 0.5.0

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

### Patch Changes

- 1d384f8: Replace the background permutation story with a surface composition story for buttons, menus, and modals.
- 1d384f8: Align TypeScript dependency ranges to ^5.9.3 across workspace packages.

## 0.3.0

### Minor Changes

- 8b565f0: Release the updated @pstdio/ui dependency contract.

## 0.2.5

### Patch Changes

- 47b5f7a: Keep ticket cards within kanban column bounds by wrapping long unbroken title strings and add Storybook coverage for URL-like tokens.
- 8eaf4ac: Add a shared searchable menu for hooks and repo branch selection.
- 8eaf4ac: Add a token usage story for the chat message parts renderer.

## 0.2.4

### Patch Changes

- 8b04ba9: Show a workspace diff hub above session chat inputs for workspace-backed sessions.
- abadf39: Replace read-only Monaco diff surfaces with git-diff-view and add adapter coverage tests.
- 8b04ba9: Replace the session chat empty state with a reusable chat skeleton and unavailable-session fallback.

## 0.2.3

### Patch Changes

- e6a54d3: Improve collapsed sticky user message: shorter height, no scroll, overlay show-more button, stays floating when expanded
- 05705ba: Use ScrollArea for rich-text content editable scrolling.

## 0.2.2

### Patch Changes

- 7289bdd: Improve chat message spacing and add scroll-area handling for rich messages and chat input.
- c88802f: Add a configurable TicketsWorkspace with persisted display settings, filtering controls, and ticket grouping utilities.

## 0.2.1

### Patch Changes

- 79285d3: Add startup script save/pull workflows and settings editor
- cad7cc9: Persist unsent chat drafts per session and cap composer height in the sessions chat panel.
- de3bae4: Keep the new-session chat editor stable while typing and add a sessions e2e regression test that verifies focus is retained across consecutive keystrokes.

## 0.2.0

### Minor Changes

- a3cfc65: Add router-agnostic SidebarNext and SidebarTree components with persisted zustand state and story-driven behavior coverage.

## 0.1.1

### Patch Changes

- 08be990: Add optimistic follow-up messaging and keep chat input focused after send.

## 0.1.0

### Minor Changes

- 5134866: Initial release
