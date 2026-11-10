# Temporary conversation resize scroll classification

Proposed: 2026-11-10

Status: Accepted.

## Intended behavior

A conversation following new messages keeps following while its panel changes size. Scrolling up with the wheel or keyboard keeps earlier messages available, including while new responses arrive and the panel resizes. An explicit stop also remains stopped when visible content shrinks and the browser clamps the viewport near the tail.

## External limitation

`use-stick-to-bottom` 1.1.3 delays upward-scroll classification until after resize observations. It compares an event's old scroll offset with a previously requested offset, but its resize marker can reset before that delayed callback. The browser can also clamp the offset when the viewport grows without changing the content height observed by the library. Both paths mistake a layout-driven move at the bottom for an attempt to read history and stop following subsequent messages.

The geometry reproduction uses the real chat panel, an animated width and height change, and responses arriving once per animation frame. Exact main reproduces the loss without any user scroll. This proves a baseline layout defect; it does not identify the exact event sequence in the earlier native streaming failure.

The same library also clears its escaped-following intent when visible content shrinks near the bottom. This can undo an explicit stop before the next response arrives. The stopped-following shrink regression observes a visible negative resize clearing the live stopped intent, then the next batch seizing the reader's position. This is a separate contract from losing automatic follow. The original complete resize file passes on the current unmodified-main control; it does not contain this new regression, so that pass is not evidence of a matching-main failure.

## Temporary repair

Patch the library to capture the bottom offset with each scroll event. An upward event that remains at that event's bottom is not an escape. Keep the library's wheel, selection, animation, and other upward-scroll behavior. This avoids introducing a second scroll controller or a second copy of follow state.

The patch also guards the negative-resize re-lock with the existing live escaped intent. A shrink may clamp pixels, but it cannot clear an explicit stop. The normal following, positive-resize, selection, wheel and keyboard paths remain unchanged; no second intent state is introduced.

The repository records the patch through Bun's supported dependency patch mechanism. The UI build bundles this one dependency so published UI consumers receive the repair as well; the package's other dependencies remain external. The hidden-panel restoration in ADR 0075 remains unchanged.

## Limitations

The patch is bound to library version 1.1.3 and must be reviewed when that dependency changes. It adds one existing geometry getter read per scroll event. The public root's children callback, `contextRef`, and custom `instance` props retain the library's implementation and shapes. Directly importing `useStickToBottomContext` from a separate copy of the dependency does not share the bundled provider. The UI neither exports nor documents that dependency hook; such direct imports couple consumers to an internal dependency.

## Removal

Remove the patch and restore the dependency's normal externalization when an upstream release both classifies layout-driven clamps against the scroll event's geometry and preserves escaped intent across visible content shrink. Keep the real Canvas resize, wheel, Page Up, history-reading, and return-to-latest regression checks when upgrading. Retest hidden-panel restoration separately when changing that integration.
