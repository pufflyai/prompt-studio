# Temporary webview move fallback

Proposed: 2026-10-05

## Intended behavior

Moving a workbench tab changes its panel while preserving its live view. An iframe must keep its browsing context, unsaved input, and running work. Hidden retained views remain connected to their last panel until they are shown again or released by their owner.

## External limitation

The DOM `moveBefore` API moves a connected node without resetting iframe state. Current Chromium and Firefox support it. The WebKit browser bundled with Playwright 1.60 does not expose it. Ordinary DOM insertion reloads an iframe when its ancestor moves between parents. See the [DOM specification](https://dom.spec.whatwg.org/#dom-parentnode-movebefore) and [Chrome's API explanation](https://developer.chrome.com/blog/movebefore-api).

## Decision

Use `moveBefore` when moving an already connected view host to another connected panel. Initial attachment uses `appendChild`. On browsers without `moveBefore`, temporarily use `appendChild` for explicit moves between panels.

Keep this fallback in the workbench view host. Do not add stored state or expose browser internals to extensions. Replacing the panel layout with a global positioned overlay could avoid reparenting, but would require new sizing, scrolling, clipping, focus, and accessibility ownership. That wider redesign is not justified for this browser limitation.

## Limitations

Explicit iframe moves between panels, including switching Side between floating and attached presentation, reload the iframe in browsers without `moveBefore`. React view identity is retained. Ordinary tab selection, panel hiding, and page navigation preserve iframe state in all supported engines because their hosts stay connected. Both Side presentation slots stay mounted; closing keeps its host in the last slot while hiding the shell.

## Removal

Remove the explicit-move fallback when every supported browser implements `moveBefore`. Verify iframe markers and unsaved input across moves in browser tests before removing it. If preserving explicit iframe moves in older WebKit becomes a requirement, replace the fallback with a separately designed layout that keeps every iframe under one permanent parent.
