# UI Canvas

Browse a project's own components and design pages inside Prompt Studio. The project writes small `*.canvas.tsx` files next to its components, and the [`@pstdio/canvas`](https://www.npmjs.com/package/@pstdio/canvas) package builds them. UI Canvas shows what that package built. Its extension backend never builds anything or runs project code. Canvas code runs only inside each frame, a sandboxed iframe with no access to Prompt Studio. The workbench saves each canvas's camera, frame positions and frame themes.

UI Canvas is an optional extension. Install it from the extension catalog:

```sh
pst extensions add canvas
```

A downloaded package also works without Git or a source checkout:

```sh
pst extensions add /path/to/pstdio.canvas-<version>.tgz
```

It is not installed or enabled by default. It includes the `canvas` skill for browsing, comparing themes, arranging frames and writing canvas files. Use a runtime that satisfies the extension API range declared in `package.json`.

## Set up a project

```sh
bun add -d @pstdio/canvas
bun x pstdio-canvas watch
```

Keep the watcher running while you work, or let an agent start it. It writes each build to `.pstdio/extension-storage/pstdio.canvas/build/`, the folder UI Canvas reads, and puts a `.gitignore` there so builds are never committed. UI Canvas declares that folder as a watched storage folder: when the watcher writes a new build, the host tells UI Canvas, and it reloads only the frames whose code changed. Until a build exists, UI Canvas shows these commands and an example file.

A canvas file is one canvas, and each named export is one frame:

```tsx
// src/button.canvas.tsx
import { Button } from "./button";

export default { title: "Components/Button", component: Button };
export const Primary = { args: { children: "Save" } };
export const Loading = () => <Button loading>Save</Button>;
```

The title's part before the last `/` is the navigation group. A `.canvas/preview.tsx` file supplies CSS and decorators for the canvas files below it. See the [`@pstdio/canvas` README](https://www.npmjs.com/package/@pstdio/canvas#readme) for the full format.

## Work with a design

Open **UI Canvas** in the project navigation. Canvases are grouped by their titles. Selecting one opens an unpinned preview tab; the next unpinned selection replaces it. Pin a tab to keep it. A canvas whose build failed shows its error; the others still work.

Select a frame before using its contents: the first click selects it without activating a control. Clicking another frame or empty canvas space changes or clears selection; Escape clears it when the canvas has focus. Changing selection keeps mounted frames and their input.

- Click a frame name to copy it. If clipboard access fails, select and copy the displayed name.
- Drag a frame's move handle, or focus the handle and use arrow keys. Shift moves farther.
- Drag empty space, hold Space while dragging, or use the middle mouse button to pan.
- Use Ctrl/Meta + wheel or trackpad pinch to zoom around the pointer. Ordinary wheel input scrolls nested content while it can scroll, then pans the canvas.
- Focus the canvas for arrow-key pan, `+`/`-` zoom, `F` to fit, and `0` to reset.

Each frame has a **Theme** menu with Follow app and the built-in themes. A frame whose file sets `defaultTheme` to a theme only the project knows shows that theme too; the frame receives its id, and the project's decorator supplies its colors. Theme changes keep input and local state.

Frames show a loading panel while their code starts. Each canvas starts at most four frames at once, selected and visible frames first.

Use the CLI from the linked project directory:

```sh
pst canvas list
pst canvas open --canvas src/button.canvas.tsx
pst canvas layout read --canvas src/button.canvas.tsx
```

## How frames load

The `preview.assets` command reads the modules a frame needs from the build folder, using the module graph in the build's `manifest.json`. The view decodes shared modules once and reuses them across frames. Each frame is an opaque sandbox with its own React, providers, theme and state. A frame that shows UI Canvas itself asks its own host for code through the `@pstdio/canvas` frame bridge.

## Develop UI Canvas

```sh
bun run --cwd extensions/canvas test
bun run --cwd extensions/canvas typecheck
```

`scripts/` holds the page that renders UI Canvas outside the dashboard for browser checks. `packages/canvas-tests` builds Prompt Studio with `pstdio-canvas build`, serves that build through this page, and runs the critical browser checks:

```sh
bun run --cwd packages/canvas-tests test
bun run --cwd packages/canvas-tests perf:startup
```

Require browser or visual checks only for critical risks: a blocked primary task, hidden essential content or controls, broken keyboard/focus behavior, preview isolation, or a critical regression. Routine copy, spacing, cosmetic, and documentation changes do not require browser runs or screenshots.
