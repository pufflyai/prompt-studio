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

## Arrange and navigate

Drag a frame's grip, or focus it and use arrow keys; Shift moves farther. Drag empty space, hold Space while dragging, or middle-drag to pan. Use Ctrl/Meta + wheel or pinch to zoom around the pointer. With canvas focus, use arrow keys to pan, `+`/`-` to zoom, `F` to fit, and `0` to reset.

```sh
pst canvas list
pst canvas open --canvas <canvas file>
pst canvas layout read --canvas <canvas file>
pst canvas layout update --help
```

Read the layout before updating it. `layout.update` accepts a JSON `--change` with camera, positions, or frame themes, keyed by export name.

## Critical checks only

Require browser or visual checks only when a change risks blocking a primary task, hiding essential content or controls, breaking keyboard/focus behavior, violating preview isolation, or reintroducing a critical regression. Keep examples for exploration without a test for every example. Report the canvas file, exact export, checks run and any untested device behavior.
