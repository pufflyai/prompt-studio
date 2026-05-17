# Storybook Play Coverage

## Problem

After removing the `@storybook/addon-vitest` integration, only stories with `play` functions are tested by `test-storybook`. Components with stories but no `play` function have no automated Storybook smoke coverage.

## Components without play tests

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

## Components with play tests (covered)

- `data-table.stories.tsx`
- `param-editor.stories.tsx`
- `slider.stories.tsx`
- `style-guide.stories.tsx`

## Risk

Components without play tests have no automated smoke testing. Rendering regressions will only be caught during manual Storybook review.

## Contributor guidance

Add a `play` function to each story listed above when touching that component area. At minimum, a smoke test should wait for the component to render:

```tsx
play: async ({ canvasElement }) => {
  const canvas = within(canvasElement);
  await canvas.findByRole("...");  // assert something rendered
},
```

Interactive components (inputs, modals, file browsers) should have play functions that exercise their key interactions.
