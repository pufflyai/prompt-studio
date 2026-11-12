# Temporary hidden conversation scroll restoration

Proposed: 2026-10-14

Status: Accepted.

## Intended behavior

A retained chat panel preserves its scroll position while hidden. Showing it again keeps the same response visible. A panel following the tail continues to follow it, including messages received while hidden.

## External limitation

`use-stick-to-bottom` 1.1.3 treats a hidden content element's zero height as a real shrink. Its resize observer clamps the scroll position and marks the chat as following the tail. Showing the panel then scrolls to the tail, including when the person was reading earlier responses. The public options do not distinguish a hidden element from a visible content shrink.

Changing virtual row measurements cannot prevent this: the scroll controller observes the containing content element. A clean library-level fix needs its resize observer to ignore elements without layout. Replacing the scroll controller would affect its selection, wheel, resize, and animation behavior across public conversation components.

## Temporary workaround

The version-bound Bun patch ignores a zero-height content observation only when the content has no layout rectangles. A visible empty content element still follows the normal resize path. This prevents hidden layout from overwriting the library's live follow intent before the viewport can save it.

The conversation viewport records its last visible pixel position. When it becomes hidden, its own resize observer snapshots the library's live `state.isAtBottom` before calling `stopScroll`. On return it restores that position, or resumes tail following with `scrollToBottom`. Pixel proximity does not define intent: an explicit stop at the tail stays stopped, and a following panel may still be catching up with growing content. The snapshot belongs to the viewport and disappears when the conversation changes or unmounts.

The integration uses the library's public live state and methods. It stays in one hook beside the conversation viewport; virtualization does not own or duplicate this state. The existing UI build bundles the patched dependency, as described in [ADR0142](0142-temporary-conversation-resize-scroll-classification.md).

## Limitations

This adds a resize observer and one visible-position snapshot per mounted conversation viewport. It restores a pixel offset, so content changed above that offset while hidden can change which text occupies it. It does not retain content that virtualization unmounts.

## Removal

Remove the hidden-content patch and hook when the upstream library preserves position and follow intent for ancestors hidden with `display: none`. Review both when changing library version1.1.3. Keep the real Canvas resize/hidden conversation checks, including explicit stop at the tail, returning to follow without pixel movement, history reading and arrivals while hidden. Do not infer the cause of native streaming failures without an observed visibility transition.
