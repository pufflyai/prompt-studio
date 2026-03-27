# @pstdio/ui

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
