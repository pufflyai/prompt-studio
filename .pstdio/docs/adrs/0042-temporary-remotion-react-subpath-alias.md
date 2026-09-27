# Temporary Remotion React subpath alias

Proposed: 2026-09-27 (local file creation date)

## Status

temporary workaround.

## Intended design

Remotion Studio and CLI exports should load the same React package and shared UI as the extension player without custom module aliases.

## External limitation

Remotion 4.0.529 aliases `react` to its entry file. Webpack applies that alias to `react/compiler-runtime` too, producing an invalid path. The shared UI is built with the React compiler and imports that public React subpath, so an unmodified Remotion bundle fails.

## Temporary workaround

The motion package adds an exact alias for `react/compiler-runtime` before Remotion's aliases. This keeps React's compiler runtime from the same installed React version. The override is isolated to `design/motion/remotion.config.ts`; production builds and the extension player are unchanged.

This adds a small dependency on Remotion's bundler configuration.

## Removal

Remove the override when Remotion resolves React subpaths correctly, then verify Studio and render a composition using shared UI.
