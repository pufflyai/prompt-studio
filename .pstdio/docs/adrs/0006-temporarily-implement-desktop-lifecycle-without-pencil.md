# ADR: Temporarily Implement Desktop Lifecycle Without Pencil

## Status

Temporary. Remove this decision after the Pencil editor transport is reliable and the desktop lifecycle designs have been reviewed in the canonical design file.

## Ideal design

The startup, recovery, active-work confirmation, and closing views should be designed first in `design/prompt-studio-design-system.pen`. The Electron renderer should then match those frames with exported `@pstdio/ui` components, recipe variants, and theme tokens.

## External limitation

The Pencil MCP server process is running, but its Visual Studio Code editor transport repeatedly reports `transport not connected to app`. Opening the canonical file in existing and new editor windows does not restore the connection. The encrypted `.pen` file cannot be inspected or edited safely without that transport.

## Decision

Complete the desktop lifecycle behavior with the existing `@pstdio/ui` components, recipe variants, and semantic tokens. Add Storybook states and Electron Playwright screenshots so the temporary visual result is concrete and reviewable. Do not edit the `.pen` file by hand.

## Trade-offs

The renderer can be reviewed, tested, and shipped, but the Pencil document will temporarily lack the matching lifecycle frames. A later design review may require visual changes even when the behavior and accessibility remain correct.

## Isolation

This exception applies only to the PS-217 lifecycle views. It does not add one-off CSS, fixed design values, compatibility flags, duplicate product state, or a second renderer. All visual choices remain inside the existing design-system vocabulary.

## Removal

When Pencil reconnects:

1. Add the four lifecycle frames to the canonical `.pen` file.
2. Compare the Storybook and Electron screenshots with those frames.
3. Update shared recipes or tokens before changing component callers when the design needs a missing style.
4. Replace this ADR with the final design decision or mark it superseded.
