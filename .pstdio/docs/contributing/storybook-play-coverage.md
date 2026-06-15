# Storybook Play Coverage

## Mount-smoke tier

CI runs `@storybook/test-runner` against the static `@pstdio/ui` storybook in
the mount-smoke tier (see `tests.md`). The runner:

1. Loads every published story in a Playwright browser and fails if render
   throws.
2. For stories with a `play` function, runs the play body and fails on any
   assertion error.

Stories without a `play` function still get the render-time smoke. Adding a
`play` body strengthens the safety net for the components most likely to
regress under interaction.

## Adding play coverage

When you touch any of the stories below, add a `play` smoke at minimum:

```tsx
import { within } from "storybook/test";

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole("..."); // assert something rendered
  },
};
```

Interactive components (inputs, modals, file browsers, drag-and-drop) should
exercise their key interactions, not just render.

## Stories without play tests

### Chat UI
- `ai-conversation.stories.tsx`
- `ai-message.stories.tsx`
- `ai-response.stories.tsx`
- `attachment-list.stories.tsx`
- `chat-input.stories.tsx`
- `chat-panel.stories.tsx`
- `message-parts-renderer.stories.tsx`
- `model-swap-separator.stories.tsx`
- `tool-invocation-timeline.stories.tsx`

### Rich Text
- `collaborative-markdown-editor.stories.tsx`
- `markdown-editor.stories.tsx`
- `prompt-input.stories.tsx`
- `rich-message.stories.tsx`
- `DataTableNode.stories.tsx`

### General Components
- `breadcrumb.stories.tsx`
- `button.stories.tsx`
- `column-file-browser.stories.tsx`
- `delete-confirmation-modal.stories.tsx`
- `diff-bubble.stories.tsx`
- `diff-drawer.stories.tsx`
- `drawer-inline.stories.tsx`
- `docs-outline.stories.tsx`
- `empty-state.stories.tsx`
- `file-selector.stories.tsx`
- `folder-picker-dialog.stories.tsx`
- `info-card.stories.tsx`
- `item-section.stories.tsx`
- `layout.stories.tsx`
- `menu-item.stories.tsx`
- `open-source-notices-screen.stories.tsx`
- `panel-menu.stories.tsx`
- `properties.stories.tsx`
- `resource-badge.stories.tsx`
- `session-indicator.stories.tsx`
- `toaster.stories.tsx`

### Tickets
- `ticket-board.stories.tsx`
- `ticket-card.stories.tsx`
- `ticket-list.stories.tsx`

## Stories tagged `mount-smoke-skip`

The following stories opt out of the mount-smoke tier. Each one is tracked by
a follow-up and carries a `TODO(PS-69)` comment with the rationale:

- `Patterns/Data Renderer/Data Renderer › DragAndDrop` — synthetic
  `dragstart`/`dragover`/`drop` events race react-dnd setup in the runner.
  Re-enable once the play body uses `userEvent.drag()`.
- `Patterns/Data Renderer/Data Renderer › EmptyColumnPersists` — same root
  cause as above.
- `Patterns/Data Renderer/Filter Menu › SelectFilter` and
  `SelectMultipleFilters` — overlay checkbox lookup races the menu mount;
  re-enable after the menu mount-flush is tightened.
- `Patterns/Data Renderer/Internal/Live Options › LiveOptions` — list-view
  group badge does not pick up live enum recolor updates from the live
  options store. The play body is a regression test; re-enable after the
  list-view color invalidation is wired through.

Removing a `mount-smoke-skip` tag is a one-line change. If you fix the
underlying issue, drop the tag and the `TODO(PS-69)` comment in the same PR.
