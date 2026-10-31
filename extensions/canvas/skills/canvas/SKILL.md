---
name: canvas
description: Work with the UI Canvas extension to inspect interactive examples, compare variants and themes, arrange frames, or maintain source-owned canvas designs when their sources are available.
---

# Work with UI Canvas

Use UI Canvas as an interactive design workspace. It is optional: follow the project's existing workflow when it is unavailable or disabled. Installing Canvas also makes this skill available.

## Browse and compare

- Open **UI Canvas** in project navigation, or search for a canvas as a resource. Expand Design System, Workbench Core, Dashboard, Extensions, or Landing Page to find examples. Use **Props and source** to inspect parameters and source references.
- A canvas opens in the shared project tab tray as an unpinned preview. Opening another replaces that preview. Pin a tab when it must remain open.
- Select a frame before interacting: the first click selects it without activating its contents. The selected frame has an outline. A later click uses its controls. Empty canvas space or Escape with canvas focus clears selection.
- Use **Variant** beside **Theme** for predefined component states. A variant change or frame reset starts fresh fixture state. Changing a frame's theme preserves its current input and does not change other frames or the app theme.
- Preview actions use synthetic data and local fixture state. They do not create real projects or edit project records. Unsaved preview input is temporary and does not survive a reload.

## Arrange and navigate

Drag a frame's grip, or focus it and use arrow keys; Shift moves farther. Drag empty space, hold Space while dragging, or middle-drag to pan. Use Ctrl/Meta + wheel or pinch to zoom around the pointer. Ordinary wheel input scrolls a nested region before panning the canvas.

When the canvas shell has focus, use arrow keys to pan, `+`/`-` to zoom, `F` to fit, and `0` to reset the camera. Camera reset preserves frame positions and preview inputs. Frame reset clears that frame's fixture state. Preserve native editing shortcuts while a control has focus.

Use the extension's CLI from the linked project directory:

```sh
pst canvas list
pst canvas open --canvas <id>
pst canvas layout read --canvas <id>
pst canvas layout update --help
```

Read the existing layout before updating it. `layout.update` accepts a JSON `--change` with camera, positions, or frame themes. Preserve unrelated entries and stable IDs. Layout and theme changes are project-scoped; they do not edit the catalog's component source.

## Change a design

Installed Canvas contains compiled examples. **Props and source** identifies their original source paths; those files may belong to the Prompt Studio repository rather than the current project. Check that the relevant sources are available before editing. Do not modify generated archives or try to execute source strings through project storage.

For source-owned changes in a Prompt Studio checkout, read [Maintain Canvas source](references/maintaining-canvas.md). Keep related examples in one topic canvas, use variants for predefined parameters, preserve stable IDs and links, and rebuild the catalog before claiming that a preview reflects changed source. Use the project's ticket/design policy when preparing a design for implementation. A canvas URL alone does not transfer source changes to another workspace.

## Critical checks only

Require browser or visual checks only when a change risks blocking a primary task, hiding essential content or controls, breaking keyboard/focus behavior, violating preview isolation, or reintroducing a critical regression. Use the smallest representative scenario and identify its risk. Keep examples for exploration without a test for every example or an exhaustive variant/theme/viewport matrix.

Add screenshot comparisons only when appearance itself is the critical contract and behavioral assertions cannot establish it. Routine copy, spacing, cosmetic and documentation changes do not require browser runs or screenshots. Preserve explicit user-requested visual verification, relevant unit/type/build checks, and existing fixed performance workloads, budgets and timeouts.

Report the canvas, exact preview or variant, changed sources when applicable, checks run and any untested device behavior.
