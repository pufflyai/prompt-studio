# Temporary Motion Lab scene link pass

Proposed: 2026-09-30

## Status

SUPERSEDED. Scenes no longer need export discovery on the server. The compiler marks shared imports with a `motion-lab-shared:` placeholder, and the preview links them to the library modules it already loaded. The link pass and export discovery are removed. Discovery also failed for good in a long-running host when a package lookup failed once, because Bun keeps failed lookups for the life of the process.

## Intended design

The scene compiler should discover shared exports when Bun resolves an imported library. A scene should never build unused libraries. The compiler should bundle local files and replace shared imports with references to the preview's module instances in one pass.

## External limitation

Shared export discovery uses `Bun.build` to inspect browser libraries without executing them on the server. Bun 1.4.2 stalls when a build plugin's `onLoad` callback awaits another `Bun.build`. Calling the callback's `defer()` first still stalls. A cold Remotion scene reproduces this; a React-only scene does not because React exports need no build.

The one-pass design cannot discover browser exports on demand until Bun can finish nested builds. Eagerly building every allowed library avoids nesting but made a React-only scene exceed the existing five-second CI limit.

## Temporary workaround

First bundle the scene's local files with allowed shared imports marked external. Scan the resulting JavaScript for its remaining imports and discover exports only for those libraries. Then link the bundled scene against the shared-module shims in a separate build.

The extra link pass adds a small build step, but avoids compiling unused libraries. Bun still owns dependency traversal, JSX transformation, syntax diagnostics, and module linking. Export discovery remains cached. This is isolated to Motion Lab's scene compiler and shared-import linker; it adds no host API or stored state.

## Removal

When the repository's Bun version supports awaiting `Bun.build` from an `onLoad` callback, verify a cold Remotion scene and React-only scene. Move export discovery into the shared-module loader and remove the separate link pass. Keep coverage for unused libraries, imports in local helpers, invalid imports, and syntax errors. Do not increase test time limits.
