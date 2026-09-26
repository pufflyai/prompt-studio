# Temporary export marker for bundled type files

This is a temporary workaround, not the intended design.

`@pstdio/sdk`, `@pstdio/ui`, and `@pstdio/workbench` publish one bundled `.d.ts` file per entry point. They are built with `rolldown-plugin-dts`. A published type file should export exactly what the source entry exports.

TypeScript has a rule for declaration files: when a `.d.ts` module has no explicit `export { … }` statement, every top-level declaration in it counts as exported, even without the `export` keyword. `tsc` adds `export {};` to its output to turn this off. `rolldown-plugin-dts` 0.28.6, the latest release, does not add it. When an entry uses only inline exports, such as `export declare const`, its internal declarations become public. The first case found is `@pstdio/sdk/extensions/react`. Its bundled types exported the internal interfaces `CommandQueryInput` and `CommandMutationInput`.

A clean fix needs the plugin to add the marker. The plugin has no option for this, and its source has no code for it.

As a temporary workaround, `scripts/build/mark-dts-modules.ts` appends `export {};` to every `.d.ts` file in a package's `dist` folder after the type build. The marker never changes a file that already has an export statement, so the script can mark every file without checking each one. The trade-off is one extra build step in three packages, plus a script that must run after every type build.

The workaround is isolated to that one script. The three packages call it from their `build` scripts, and it has its own test.

Remove the workaround when `rolldown-plugin-dts` adds the marker itself. To check a new release, remove the `mark-dts-modules` step from the three `build` scripts, rebuild, and confirm that `@pstdio/sdk/extensions/react` exports only `useCommandQuery` and `useCommandMutation`. Then delete the script and its test.
