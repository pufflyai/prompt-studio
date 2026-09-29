# Temporary docgen filter in the workbench Storybook

Proposed: 2026-09-27

## Status

Accepted as a temporary workaround.

## Intended design

Storybook docgen reads a component's source and builds its prop table. The workbench Storybook documents workbench components, so docgen should only read files in `packages/pstdio-workbench/src`. Code from other packages is a dependency. Storybook should skip it, as it skips everything in `node_modules`.

## External limitation

`@storybook/react-vite` 10.6 runs its `react-docgen` plugin on every module whose path is not in `node_modules`. The plugin has no include or exclude option. The only setting is the `typescript.reactDocgen` engine name or `false`.

Bun links workspace packages, and Vite loads a linked package by its real path, such as `packages/ui/dist/rich-text-DtQpHBlX.js`. That path is not in `node_modules`, so Storybook treats `@pstdio/ui` and `@pstdio/sdk` code as workbench source. Docgen parses those files, and the files they import, on the main thread before the first story can render.

On a cold start of the e2e probe story, docgen took 8.4 s of a 13.3 s first render. Only 1.0 s of it was for `packages/pstdio-workbench/src`. In CI the same first render takes 32 to 45 s of the 60 s budget in `packages/e2e/src/scripts/storybook-server.ts`.

A clean fix needs Storybook to skip linked workspace packages or accept an include pattern. `reactDocgen: false` is not a fix, because the workbench autodocs pages need prop tables.

## Temporary workaround

`packages/pstdio-workbench/.storybook/main.ts` wraps the Storybook plugins with Vite's public `withFilter` helper. The filter lets the `storybook:react-docgen-plugin` transform run only for files in the workbench `src` folder. Prop tables for workbench components stay the same. Components from other packages get no prop table in this Storybook, which is correct, because the ui Storybook documents them.

The trade-off is a dependency on the plugin name `storybook:react-docgen-plugin`. If Storybook renames the plugin, the filter matches nothing and docgen runs on every linked file again. Nothing breaks, but cold starts become slow again.

The workaround lives only in the workbench Storybook config. The dashboard Storybook has no docs pages, so it turns docgen off with `typescript.reactDocgen: false` and needs no filter.

## Removal

Remove the filter when Storybook can skip linked workspace packages or accepts an include pattern for `react-docgen`. Check each Storybook upgrade. To confirm, remove the filter, start the workbench Storybook with an empty `node_modules/.cache`, and check that docgen no longer runs for `packages/ui` or `packages/sdk` files.
