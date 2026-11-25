# Temporary Escape delegation to an open popover

Proposed: 2026-11-25

Status: Accepted.

## Intended behavior

Escape dismisses the topmost open popover and returns focus to its trigger. A containing dialog keeps its current view and draft. A subsequent Escape can dismiss the dialog.

## External limitation

Zag 1.35.3 waits for an animation frame to register a dismissable layer. React can commit a visible popover before that frame. During the gap, Zag still sends Escape to the containing dialog. Prompt Studio currently pins Chakra releases that use this version of Zag. Published UI consumers resolve Chakra as a peer dependency, so a repository patch would leave independent installations exposed.

## Decision

Use the scoped dialog's Escape callback to delegate to the most recently opened, visible scoped popover that it owns. Zag invokes that callback only when the dialog is its topmost layer. The popover applies its standard Escape settings and closes through its existing machine, which returns focus. Layout effects register and release the delegate as the popover opens, closes, or suspends.

## Removal

Remove this delegation when the supported Chakra releases include [Zag's post-commit layer registration](https://github.com/chakra-ui/zag/blob/main/CHANGELOG.md#1440---2026-09-12) from 1.44.0 or later. Verify early Escape after reopening, nested modal focus, retained view dismissal, and whole-surface suspension against the maintained Canvas cases. Keep the regression test.
