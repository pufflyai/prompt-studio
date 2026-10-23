# Keyboard shortcuts

Navigate visible panels, choose an action's target, and discover available keyboard shortcuts.

## Open the keyboard menu

Press **Alt+Shift+Space** to enter the keyboard menu. Choose View (V), Go (G), Create (C), Current view (A), Extensions (E), Settings (S), or Help (H). Press `/` to search actions. Backspace returns one level; Enter or Escape finishes. Keyboard Shortcuts under Help is a searchable reference. Shortcut editing and alias controls are deferred.

On macOS, Alt is Option. Entry matches the physical Space key even when Option produces a non-breaking space. Shortcut sequences use a small redo arrow between steps. The keyboard menu has no Back/Exit buttons or instructional footer; Backspace, Enter, and Escape remain available.

Extensions appear under E as selectable rows with their display names. Use Up/Down and Enter, or click a name, to choose one.

## Navigation

Left and Right select the previous or next tab across the visible layout and wrap at either end. Navigation keeps keyboard mode active. Enter or Escape returns focus to the selected presentation, including Secondary. Clicking an editor or leaving the window ends the mode.

Alt+Shift+1 through Alt+Shift+9 directly select global tab numbers. These chords work without opening the keyboard menu and do not open a picker. Numbers follow spatial placement, then displayed tab order within each strip. Opening, closing, moving, reordering, or changing the layout recomputes contiguous numbers. Numbers appear on tabs while keyboard mode is active. View → T opens a searchable picker for tabs beyond nine. Direct selection outside keyboard mode stays outside it.

View → N chooses a destination and addable panel type for a persistent new tab. Create → S starts the Session tab flow. Current view → N starts a fresh session in an existing Session tab. View → O moves one tab while preserving its identity; View → R repositions a whole panel using its allowed positions. Canceling an unfinished flow changes nothing.

## Current view and conflicts

Current view considers the selected presentation in every visible panel, including attached menus. Hidden tabs and collapsed panels do not contribute. An action that has several targets opens a modal with resource names and panel locations. Different actions sharing a key first require an action choice. Nothing is selected initially, and Enter on the heading executes nothing. Search, digits, arrows and Enter, or pointer selection choose an explicit row.

Choices retain their identities while the selector is open. A missing or unavailable target never redirects to another target. The same resource mutation is invoked once when the same resource is shown twice; panel actions retain separate presentation targets. Required parameters use the existing command form after closing the selector.

## Extension contributions

An extension adds optional `layer`, `targetScope`, and `sticky` fields to its existing `defineKeybinding` contributions. Existing direct bindings keep their behavior. Layer keys are relative to their group. Shared layer keys are allowed because the host resolves action and target ambiguity. `targetScope` is `project`, `resource`, or `panel`. `sticky` retains keyboard mode after execution; ordinary actions finish. Navigation declares sticky behavior by default.

The Extensions group shows extension names. Use Up/Down and Enter, click a name, or search to choose an extension. Then press the displayed action key. An internal extension ID is never a key a person must type. Hints outside a chosen extension omit paths that cannot be typed directly.

The resolved catalog supplies execution, the shortcut reference, contribution details, navigation hints, menus, and palette hints. Hints match the typed action and its arguments. Navigation hints appear in keyboard mode, preserve existing badges, and show the remaining keys or the actual opening chord. All consumers share the catalog for unchanged workbench inputs; action execution rechecks current availability.

## Webviews

Managed webviews negotiate explicitly global entry chords with the host. The guest consumes an owned chord synchronously and sends a typed request. The host validates the live frame and effective binding, then owns plain keys in its menu. Ordinary typing, editor keys, terminal keys, composition, and local modal controls remain local. The selected editor receives focus again when navigation finishes.

Opaque nested previews can include `webviewKeyboardRelayDocument` from `@pstdio/sdk/extensions` in each frame. The managed parent supplies a bounded profile. This relay supports keyboard-menu entry and exact tab selection only; it cannot invoke arbitrary host commands. Messages must come from a direct child, and requests must come from the focused child. Removed bindings no longer execute.
