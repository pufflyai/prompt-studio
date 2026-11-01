# Temporary tooltip hover reset

Proposed: 2026-10-23

Status: Accepted.

## Intended behavior

Tab title tooltips appear only when their labels are clipped. Labels and their observers stay mounted when a resize or rename changes that condition. Disabling a tooltip must close it, clear its hover state, and release keyboard handling. Hovering it again after it becomes eligible must work on the first attempt.

## External limitation

Chakra uses Zag tooltip 1.35.3. Its disabled trigger ignores pointer leave. Disabling an open tooltip closes it but leaves its pointer-move flag set. If the pointer leaves while disabled, the next enabled hover can fail to open. Controlling `open` alone also fails: Zag's immediate handoff between adjacent tooltips can open a disabled title's machine despite `open={false}`.

A presence-only gate hides the popup but leaves the hidden machine open and consuming Escape. Neither approach restores the intended interaction.

## Decision

Keep the tooltip root mounted and use its native disabled state when the label fits or the tooltip is unavailable. A small helper inside the shared Tooltip remembers the last committed, enabled trigger's public pointer-leave callback. When the tooltip becomes disabled, the helper calls that callback once to clear the native hover state.

The callback currently ignores its event argument. The helper casts it to a no-argument callback and does not dispatch a fabricated DOM event. It adds no separate hover state and is isolated in the shared Tooltip component. Uncontrolled callers remain uncontrolled during overflow measurement.

## Limitations

This is a temporary workaround for upstream tooltip behavior, not the intended design. It relies on the current public trigger callback accepting a call without an event. A dependency upgrade must verify this assumption or remove the helper.

## Removal

Remove the helper when an upstream tooltip release resets hover state on disable and honors disabled state during adjacent tooltip handoff. Keep the native disabled gate and overflow measurement. Verify direct long-to-short tab handoff, resize/leave/narrow/first-hover, explicit disable and empty content, stable label identity, keyboard focus, and Escape propagation before removing it.
