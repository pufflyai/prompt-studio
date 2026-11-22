# Temporary Monaco editor recreation after Activity reveal

Proposed: 2026-11-20

Status: Accepted.

## Intended behavior

A code or diff editor in a hidden project or tab works again when it is shown. Switching to another project and back keeps the open file's unsaved text, its undo history, cursor and scroll position. The project never fails with "This project couldn't open" because of an editor that was hidden.

## External limitation

The workbench hides inactive projects and tabs with React `<Activity>`. Hiding runs every effect cleanup in the subtree but keeps component state and refs. `@monaco-editor/react` 4.7.0 disposes its Monaco editor in that cleanup and keeps the editor ref, the mounted flag and `isEditorReady`. On reveal its update effects run against the disposed editor: `editor.setModel` throws "InstantiationService has been disposed", Monaco's theme handler then throws on an undefined view part, and the project error boundary replaces the workbench. The library never creates a new editor because it still considers itself mounted. Only 4.8 release candidates exist, and none fixes this.

Desktop benchmark B4 reproduced this on Linux, macOS and Windows: open a file, switch to a second project and back.

## Temporary repair

Patch the library, through Bun's dependency patch mechanism, so that disposing an editor also forgets it. Clear the editor ref and the mounted flag, and set `isEditorReady` to false, for both `Editor` and `DiffEditor`. The library's update effects only run while ready, and its own `!mounting && !ready` effect then creates a new editor in the retained container on reveal.

`CodeEditor` passes `keepCurrentModel`, so the library keeps the model and saves its view state when it disposes the editor. A revealed editor finds the same model by its stable per-instance path and restores the saved view state, so unsaved text, undo history, cursor and scroll survive. Because React gives hiding and unmounting the same cleanup, `CodeEditor` registers its model paths with a `FinalizationRegistry` and disposes those models only after the editor's owner has been collected following a real unmount. `CodeEditor` moves the cursor to a linked source position only once per position, so a revealed editor keeps the reader's place. Both editors pass `loading={null}` to avoid the library's untranslated loading text during recreation.

## Limitations

The patch is bound to `@monaco-editor/react` 4.7.0, and `@pstdio/ui` pins that exact version while the patch exists. A lockfile update to another version would silently skip the patch.

The patch applies to this repository's install, so the dashboard, desktop app and runtime bundles include it. The published `@pstdio/ui` keeps `@monaco-editor/react` external, so its consumers get the unpatched library. Extension webviews are not hidden with `<Activity>`, so they are not affected today. A consumer that wraps `CodeEditor` in `<Activity>` would be.

Recreating an editor on reveal reattaches the retained model and costs one editor construction per visible editor on each project switch. `DiffEditor` models are rebuilt from their props. Retained code editor models stay in memory until garbage collection after the editor's owner unmounts.

## Removal

Remove the patch, the version pin and the `keepCurrentModel` lifetime handling when a stable `@monaco-editor/react` release recreates or keeps its editor correctly across `<Activity>` hide and reveal. Keep `code-editor-activity.p0.test.tsx` and the B4 project-switch journey when upgrading.
