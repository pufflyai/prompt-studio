---
name: canvas
description: Work with the UI Canvas extension to set up a project's canvases, write canvas files, inspect interactive examples, compare themes, and arrange frames.
---

# Work with UI Canvas

UI Canvas shows a project's own components. The `@pstdio/canvas` package builds the project's `*.canvas.tsx` files; UI Canvas only renders what it built. It is optional: follow the project's existing workflow when it is unavailable or disabled.

## Set up a project

1. Install the package: `bun add -d @pstdio/canvas`.
2. Start the watcher and keep it running: `bun x pstdio-canvas watch`. If the project has a script for it, such as `bun run canvas`, use that.
3. `bun x pstdio-canvas build` builds once and prints every canvas that failed, with its error. Use it to check your work.

Builds go to `.pstdio/extension-storage/pstdio.canvas/build/`, which carries its own `.gitignore`. Never commit them.

## Write a canvas file

Put `<name>.canvas.tsx` next to the component. One file is one canvas; each named export is one frame.

```tsx
import { Button } from "./button";

export default { title: "Components/Button", component: Button, description: "Primary actions." };

export const Primary = { args: { children: "Save" } };
export const Loading = () => <Button loading>Save</Button>;
export const Small = { name: "Small size", args: { children: "Save", size: "sm" } };
```

- Default export (optional): `title` ("Group/Name"), `component`, `args`, `description`, `decorators`, `fullscreen`, `defaultTheme`.
- Frames: a component, or `{ name?, args?, render?, description?, fullscreen?, defaultTheme?, decorators? }`.
- Do not export helpers from a canvas file: every named export becomes a frame. Move shared helpers to a sibling module.
- A `.canvas/preview.tsx` in any folder supplies global CSS imports and `decorators` for the files below it. A decorator is `(Frame, { theme, args }) => element`; `theme` is `{ id, mode, tokens? }`. Wrap frames in the project's providers there.
- Storybook fields (`parameters`, `argTypes`, `tags`, `play`, `globals`, `loaders`, MDX) are not supported. Keep state and effects inside a function frame.
- Use synthetic data and local state. Frames must never create real records.
- Optional types: `import type { CanvasFrame, CanvasMeta, CanvasPreview } from "@pstdio/canvas"`.

## Browse and compare

- Open **UI Canvas** in project navigation, or search for a canvas as a resource. Canvases are grouped by their titles. **Props and source** shows a frame's file, export and args.
- Select a frame before interacting: the first click selects it. Empty canvas space or Escape with canvas focus clears selection.
- **Theme** changes one frame's theme and keeps its input. **Reset frame** starts it fresh.
- When a file changes, the watcher rebuilds and UI Canvas reloads only that canvas's frames.

## Parameters, playback, and saved versions

Declare `controls` on a frame or default export: `number` with min/max/step, `boolean`, or `select` with value/label options. Args supply initial values. Select a frame to show its parameters, versions, and playback in the Frame editor menu on the right. With no selection the menu asks for a frame. Switching selection retains each frame’s temporary values and playback state. Parameters update only that frame and keep React state. Reset restores the selected version. Temporary experiments do not edit source.

Declare `motion: { duration, fps?, markers? }` to drive a `time` arg in seconds from independent play/pause, scrub, speed, and loop-range controls. Derive animation from time so scrubbing works.

Declare a literal `save: { file: "default.json", key: "values" }` for explicit saving and named JSON versions beside the canvas. Keep primitive keys/types consistent across versions. Select, save, save as new, rename, or delete versions not imported by the source. Errors preserve edits. Agents use `pst canvas parameters <action> --help` for the same operations.

For this repository's motion authoring, read `design/motion/README.md` and use `pst canvas study`. For shaders, read `design/shaders/README.md` and use `pst canvas shaders` and `pst canvas version`. Keep legacy Lab data bridges installed while importing old review choices; they no longer provide pages or compilers.

## Arrange and navigate

Drag a frame's grip, or focus it and use arrow keys; Shift moves farther. Drag empty space, hold Space while dragging, or middle-drag to pan. Use Ctrl/Meta + wheel or pinch to zoom around the pointer. With canvas focus, use arrow keys to pan, `+`/`-` to zoom, `F` to fit, and `0` to reset.

```sh
pst canvas list
pst canvas open --canvas <canvas file>
pst canvas layout read --canvas <canvas file>
pst canvas layout update --help
```

Read the layout before updating it. `layout.update` accepts a JSON `--change` with camera, positions, or frame themes, keyed by export name.

## Propose a design

A proposal shows UI a ticket will add or change before production code changes. Build it from the real components, so it keeps their look, charts and tables.

1. Put it in `proposals/<ticket>/` inside the package that owns the UI. Title it `Proposals/<ticket> <name>`, so it is grouped under Proposals.
2. Import the components it leaves unchanged. Copy only the ones it changes into the folder, keep their file names, and edit the copies. Production code never imports from `proposals/`.
3. Merge the proposal to the default branch in its own pull request, then link the canvas, frame names and folder in the ticket. Until it merges, record its pushed branch and commit SHA instead. A canvas link alone does not carry the source to another workspace.
4. The implementation moves each copy's changes into production and deletes the folder in the same change. If production changed after the copies were made, keep those changes and apply only the proposal's differences.

## Critical checks only

Require browser or visual checks only when a change risks blocking a primary task, hiding essential content or controls, breaking keyboard/focus behavior, violating preview isolation, or reintroducing a critical regression. Keep examples for exploration without a test for every example. Report the canvas file, exact export, checks run and any untested device behavior.


Animated frames show a shared timeline in a bottom tray when selected. The tray follows
selection and disappears for a static frame or empty selection. Scrub its playhead,
seek named markers, or use Play/Pause/Restart. Each frame retains its own playback
position and settings. Parameters, saved versions, speed and loop settings stay in
the right Frame editor. Existing source-code animations advertise duration and
markers; the timeline displays an animation lane without inventing property keys.
The reusable UI timeline also supports editable property tracks for tools that own
keyframe data.
