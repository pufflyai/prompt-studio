# Temporary focus fallback for embedded landing previews

Status: Accepted temporary workaround.

## Intended behavior

The falling-tools scene runs while its page is visible and active. It pauses when
the user leaves the page, hides the scene, or requests reduced motion.

## External limitation

VS Code's Simple Browser displays the site inside a webview iframe. After the
preview loads or refreshes, keyboard focus can remain in the host toolbar.
`document.hasFocus()` then returns false even though the preview is visible.
The site cannot read a cross-origin host's active editor or focus state. There is
no standard browser signal for whether that host preview is the active editor.

This was reproduced with a visible iframe and a focused input in its parent:
the scene remained at six items while the parent owned keyboard focus.

## Temporary workaround

The landing scene uses viewport intersection and document visibility in embedded
frames. A top-level browser page also requires document focus. The check lives
only in the landing scene's activity predicate; it does not affect the app or
other animations. The simulation reads this predicate on every animation frame
so it does not retain a stale focus result from page startup.

An embedded preview may keep animating while its host window is unfocused but
still reports the frame as visible. This is a temporary trade-off, not the
intended attention model. No host detection, focus stealing, or browser-storage
state is added.

## Removal

Remove the embedded-frame exception when supported preview hosts expose a
reliable active-preview signal. Use that signal to pause the simulation, and
verify refresh, host focus changes, hidden previews, and ordinary browser tabs.

## References

- [VS Code Simple Browser](https://github.com/microsoft/vscode/blob/main/extensions/simple-browser/README.md)
- [Document focus](https://developer.mozilla.org/en-US/docs/Web/API/Document/hasFocus)
