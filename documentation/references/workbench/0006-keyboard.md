# Keyboard shortcuts

Navigate visible panels, choose an action's target, and discover available keyboard shortcuts.

## Enter shortcut mode

Press **Alt+Shift+Space** to enter shortcut mode. A small bubble appears at the bottom center, using the planner zoom control's surface. It shows the opening chord and current sequence, including the last completed navigation key. Hover to reveal choices that continue from the current prefix. Up/Down also reveals choices for keyboard selection; `/` opens search. Choose View (V), Go (G), Create (C), Current view (A), Settings (S), or Help (H). Backspace returns one level; Enter or Escape finishes. Keyboard Shortcuts under Help is a searchable reference. Shortcut editing controls are deferred.

On macOS, Alt is Option. Entry matches the physical Space key even when Option produces a non-breaking space. Shortcut sequences use a small redo arrow between steps. The bubble has no Back/Exit buttons or instructional footer. Required action and target choices still use an explicit modal.

Extensions contribute to these shared groups. No flow requires choosing an extension by name first.

The shortcut reference uses the command palette's search layout and groups assigned actions by resource. Each action has one default shortcut. Rows contain the action and keys without subtitles. Internal commands with no assigned shortcut stay in command discovery. Shift+/ opens this view, including from shortcut mode.

## Navigation

**Alt+Shift+Up** runs the Sidenav's **Back to project** action from nested ticket or session navigation. It returns to the last root-level page, with Home as the fallback. The action follows the active mode's name and appears only inside a navigation level. The chord works outside and inside shortcut mode and respects focused editor inputs.

Core navigation uses its direct base chords: Alt+Shift+Left/Right for history, Alt+Shift+S for Sessions, and Alt+Shift+W for Workspaces. These work from any shortcut-mode prefix and keep the mode active; they have no duplicate Go sequence. The command palette keeps Mod+P, commands Alt+Shift+K, the Sidenav Mod+B, and settings Mod+,.

Inside shortcut mode, plain Left and Right select the previous or next tab across the visible layout and wrap at either end. One tab has an outline for the keyboard selection, even when several panels each have a selected tab. Enter or Escape returns focus to the selected presentation, including Secondary. Clicking an editor or leaving the window ends the mode.

Alt+Shift+1 through Alt+Shift+9 are the default chords for global tab numbers. User overrides live in the `workbench.keyboard` preference and can be set through `workbench.keyboard.setAssignment`; the reference is read-only. Inside keyboard mode, plain 1 through 9 select the same numbers from any navigation group. Empty-panel cards share this numbering: their displayed number opens that card in its own panel. Cards show the direct chord outside keyboard mode and the plain number inside it. An action or target chooser owns its own numbers while open. Numbers follow spatial placement and displayed tab/card order, and recompute when the layout changes. View → T opens a searchable picker beyond nine. Direct selection outside keyboard mode stays outside it.

View → N chooses a destination and addable panel type for a persistent new tab. Current view → N starts a fresh session in an existing Session tab. View → O moves one tab while preserving its identity; View → R repositions a whole panel using its allowed positions. Canceling an unfinished flow changes nothing.

## Creation and shared settings

Create actions use C followed by the first letter of the canonical resource-kind ID: N for note, T for ticket, A for artifact, S for session, and W for workspace. Extensions bind their public creation command in the `create` layer and derive that letter from the resource kind. They do not add an extension-name step.

When actions share an initial, the host sorts the available actions by name, with action identity as the tie-breaker, and offers numbered choices. For example, C → A → 1 can select Analysis and C → A → 2 Artifact. The numbers stay fixed while the chooser is open, even when contributions change. Session providers share C → S; type the displayed number to choose Codex, Claude Code, or another provider. The shortcut reference includes the numbered continuation.

Alt+Shift+T is the single default shortcut for choosing a color theme. Theme providers contribute themes to that shared picker rather than registering another shortcut. Notes keeps Alt+Shift+O, Planner Kanban Alt+Shift+P, and Artifacts Alt+Shift+A for navigation. Timeline uses Go → T. Creation keeps C → N, C → T, and C → A without additional direct creation chords.

Settings → E opens extension settings, I appearance and file icon themes, and S contributed skills. Mod+, opens agent runtime and skill setup. These destinations are registered once, regardless of the number of providers.

Creation uses the same UI as the resource's existing entry point. Notes create and open directly, with bound empty parameters instead of an optional-parameter dialog. Ticket shortcuts and the palette invoke the board's `createRow.command`, so the shared creation dialog supplies markdown, attachments, editable properties, and the same submission handler. Artifact creation opens the library's existing creation choices.

## Current view and conflicts

Current view considers the selected presentation in every visible panel, including attached menus. Hidden tabs and collapsed panels do not contribute. An action that has several targets opens a modal with resource names and panel locations. Different actions sharing a key first require an action choice. Nothing is selected initially, and Enter on the heading executes nothing. Search, digits, arrows and Enter, or pointer selection choose an explicit row.

Choices retain their identities while the selector is open. A missing or unavailable target never redirects to another target. The same resource mutation is invoked once when the same resource is shown twice; panel actions retain separate presentation targets. Required parameters use the existing command form after closing the selector.

## Extension contributions

An extension adds optional `layer`, `targetScope`, and `sticky` fields to its existing `defineKeybinding` contributions. Existing direct bindings keep their behavior. Layer keys are relative to their group. Shared layer keys are allowed because the host resolves action and target ambiguity. `targetScope` is `project`, `resource`, or `panel`. `sticky` retains shortcut mode after execution; ordinary actions finish. Go destinations and other bindings for the exact same action default to sticky. An explicit `sticky: false` remains a one-shot override.

Choose a shared group by the action's purpose. The old `extensions` layer is deprecated; existing bindings join Current view as project actions until their author chooses a more specific group. Extension aliases are deprecated. Internal extension IDs never appear as keys a person must type.

The resolved catalog supplies execution, the shortcut reference, contribution details, navigation hints, menus, and palette hints. Hints match the typed action and its arguments. Navigation hints appear in shortcut mode, preserve existing badges, and show only remaining keys that can complete from the current prefix. After V, a Go action's G → A hint is hidden. Available direct chords can still appear because they work from any prefix. All consumers share the catalog for unchanged workbench inputs; action execution rechecks current availability.

## Webviews

Managed webviews negotiate explicitly global entry chords with the host. The guest consumes an owned chord synchronously and sends a typed request. The host validates the live frame and effective binding, then owns plain keys in its menu. Ordinary typing, editor keys, terminal keys, composition, and local modal controls remain local. The selected editor receives focus again when navigation finishes.

Opaque nested previews can include `webviewKeyboardRelayDocument` from `@pstdio/sdk/extensions` in each frame. The managed parent supplies a bounded profile. This relay supports keyboard-menu entry and exact tab selection only; it cannot invoke arbitrary host commands. Messages must come from a direct child, and requests must come from the focused child. Removed bindings no longer execute.
