# Temporary hidden conversation scroll restoration

Proposed: 2026-10-14

Status: Accepted.

## Intended behavior

A retained chat panel preserves its scroll position while hidden. Showing it again keeps the same response visible. A panel following the tail continues to follow it, including messages received while hidden.

## External limitation

`use-stick-to-bottom` 1.1.3 treats a hidden content element's zero height as a real shrink. Its resize observer clamps the scroll position and marks the chat as following the tail. Showing the panel then scrolls to the tail, including when the person was reading earlier responses. The public options do not distinguish a hidden element from a visible content shrink.

Changing virtual row measurements cannot prevent this: the scroll controller observes the containing content element. A clean library-level fix needs its resize observer to ignore elements without layout. Replacing the scroll controller would affect its selection, wheel, resize, and animation behavior across public conversation components.

## Temporary workaround

The conversation viewport records its last visible position and whether it was following the tail. Its own resize observer stops automatic scrolling while the viewport is hidden. On return it restores that position, or resumes tail following. The state belongs to the viewport and disappears when the conversation changes or unmounts.

The workaround uses only the library's public `stopScroll` and `scrollToBottom` methods. It stays in one hook beside the conversation viewport. Virtualization does not own or duplicate this state.

## Limitations

This adds a resize observer and one visible-position snapshot per mounted conversation viewport. It restores a pixel offset, so content changed above that offset while hidden can change which text occupies it. It does not retain content that virtualization unmounts.

## Removal

Remove the hook when the scroll library preserves position and tail-follow state for ancestors hidden with `display: none`. Keep the long-turn Storybook scenario as the behavior check. Verify middle-of-turn recovery and tail-follow recovery, including updates received while hidden, before removing the hook.
