# Patterns

Patterns are composed UI surfaces. Prefer these when building product workflows instead of assembling primitives from scratch.

Use `Foundations/Component Gallery / Composites` as the quickest visual reference for advanced components before building a new workflow surface.

## Chat

Use `ChatPanel` for full conversation surfaces. It owns the message list, empty/loading states, sticky user-message behavior, workspace hub slot, approval prompt slot, attachment rendering, and input area. Use lower-level chat components only when a host already owns the conversation shell.

Show follow-ups submitted during active work in `queuedFollowUps` immediately. Set `sending: true` until the server accepts the request. Sending rows show their prompt and attachments, and disable editing, removal, and drag actions. Saved rows remain usable while another row is sending. Replace the sending row with the saved request after acceptance; keep failed-send recovery in the conversation.

## Kanban Renderer

Use `KanbanRenderer` when users need list and board views over the same rows. Provide stable row ids, an explicit `storageKey`, typed attributes, and host callbacks for row updates, reordering, creation, and context actions.

Kanban and data tables share saved-view tabs. A custom `CollectionViewsSource` can provide `onReorderViews(ids)` to enable dragging and Alt+Left/Right moves. Save every view ID in its new order and update the source optimistically. Sources without this callback keep their fixed order.

## Tree and row navigation

Use `TreeList` for hierarchical resources with sections, expansion, selection, drag ordering, and context menus. Use `ListRow` when a custom surface needs the same row density, icons, actions, menus, and navigation behavior without a full tree.

## Editors

Use the editor patterns for markdown, prompt input, and rich-message rendering. Keep editor canvas examples deterministic and avoid real network or collaboration backends unless the story explicitly mocks the boundary.

## Diff

Use the diff patterns for changed-file navigation, file summaries, and drawer-based review flows. Prefer documented diff components over building ad hoc file-change cards.

## Dialogs and parameter help

Use `Dialog.Title`, the shared `CloseButton`, and `Dialog.Footer` with grouped actions for creation dialogs.
The workbench overlay owns its close button; widgets supply the header, body, and footer.
Put parameter explanations in `description`. `ParamEditorLabel` shows a tooltip on hover or keyboard focus of its
info button. Escape uses the shared overlay behavior and can also dismiss a containing dialog. Labels do not add an asterisk; required validation
stays in the form.

Selection dropdowns disable themselves when no enabled option or group change can change the value. A sole unset
option can still be selected. Clearable single selections and multi-selections can still remove their selected value.
Action menus keep an enabled selected action available so it can run again.
Declare icons on options and workspace providers; iconless choices stay iconless. Use `git-commit-horizontal` for
branches, `git-branch` for Git worktrees, and `level-low`, `level-mid`, `level-high`, `level-xhigh` for effort levels.
