# Temporary controlled menu dismissal focus repair

Proposed: 2026-11-17

Status: Accepted.

## Context

Clicking an input outside a menu must close the menu and leave focus in that input. Escape must return focus to the menu trigger. PS-970 reproduced a native Marmalade menu closing after an inspector iframe input received focus, then taking focus back to its trigger.

## External limitation

Zag menu 1.35.3 marks an outside pointer dismissal with `restoreFocus: false` when the target can take focus. For controlled menus, it wraps that event in `CONTROLLED.CLOSE` as `previousEvent`. Its `focusTrigger` action reads only the wrapper's `restoreFocus` value, so it loses the dismissal's focus ownership. Scoped menus need controlled open state to release listeners while their UI scope is inactive. Public menu props cannot repair this internal event handoff.

## Decision

Extend the existing version-bound Zag menu patch. The authoritative `focusTrigger` action reads the current event's `restoreFocus` value, then the previous event's value. Explicit false keeps the new input's focus. Other dismissals keep their existing behavior. Apply the same change to the ESM and CommonJS distributions.

This is a temporary dependency repair. Do not add application focus listeners, delayed refocusing, or duplicate dismissal state.

## Limitations

The patch is tied to Zag menu 1.35.3 and must be checked during dependency upgrades. It fixes the controlled transition's lost flag; it does not change iframe isolation or how pointer targets are classified.

## Removal

Remove these patch hunks when the pinned upstream release preserves the dismissal's focus flag through controlled closing. First validate outside host-input and iframe-input clicks, Escape focus return, repeated trigger toggling, command selection and inactive-scope cleanup. Keep the shared Canvas input example.
