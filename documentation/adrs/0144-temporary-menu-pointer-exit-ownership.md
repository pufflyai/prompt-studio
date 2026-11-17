# Temporary menu pointer-exit ownership guard

Proposed: 2026-11-13

Status: Accepted.

## Context

A menu can settle beneath a stationary pointer after the person chooses an action with End. Zag menu1.35.3 handles a pointer exit from the previously hovered item by clearing the current highlight, even when another action now owns keyboard selection. The controlled Canvas regression on main production proves the geometry displacement, trusted pointer exit and retained menu focus before the newer highlight disappears.

## Decision

Keep a version-bound patch on Zag menu1.35.3. Handle ITEM_POINTERLEAVE only when the exiting item's value still equals the machine's highlightedValue. Existing suspended-pointer, submenu-trigger, pointer-move, keyboard and closing rules remain in place. The machine owns the selection; a stale item's exit must not clear another item's selection.

## External limitation

The menu state machine comes from a dependency. An application-level pointer handler would duplicate its state and event ordering. Keep the correction at its authoritative state transition until an upstream release provides it.

## Limitations

The dependency patch must cover both CommonJS and ESM distributions. This controlled regression does not make the original main terminal test fail or waive its candidate-only failure. The first failing terminal trace lost Reset highlighting before the delayed renderer was released; its event cause was not recorded. A passive candidate full-file observation passed and retains that result.

## Removal

Remove the patch when the pinned upstream version enforces pointer-exit ownership. First run the controlled layout case, ordinary pointer selection/exit, nested menu navigation and terminal keyboard-focus contract against that version. Preserve the regression when removing the patch.
