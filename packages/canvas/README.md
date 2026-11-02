# @pstdio/canvas

Build a React project's `.canvas.tsx` files into previews that UI Canvas shows. The package finds the canvas files, builds them with the project's own dependencies, and rebuilds them when files change. UI Canvas only reads the result.

## Install

```sh
bun add -d @pstdio/canvas
```

The `pstdio-canvas` command runs on Bun.

## Commands

```sh
bun x pstdio-canvas watch   # build, then rebuild whenever a canvas or a file it uses changes
bun x pstdio-canvas build   # build once, for CI and checks; add --force to build even when nothing changed
bun x pstdio-canvas list    # print the project's canvases as JSON
```

All commands accept `--root <dir>` (default: the current folder). `build` and `watch` accept `--out <dir>` (default: `.pstdio/extension-storage/pstdio.canvas/build`, the folder UI Canvas reads). The output folder gets a `.gitignore` containing `*`, so it is never committed.

A canvas that cannot be built, for example because it imports a missing package, is listed with its error. The other canvases still build, and `build` exits with code 0.

## Canvas files

A canvas file is any `*.canvas.tsx` or `*.canvas.jsx` file that Git does not ignore. Outside Git, `node_modules`, `dist` and `.pstdio` are skipped. One file is one canvas; its id is its path from the project root.

```tsx
// src/components/card.canvas.tsx
import { Button } from "./button";
import { Card } from "./card";

export default {
  title: "Components/Card",
  component: Card,
  args: { title: "Usage this month" },
  description: "A bordered surface for one topic.",
};

// An object frame renders `component` with the merged args.
export const Default = {};
export const Long = { args: { title: "A much longer heading that wraps" } };

// A function frame renders whatever it returns.
export const WithAction = () => (
  <Card title="Invite people">
    <Button>Invite</Button>
  </Card>
);

// `render` receives the merged args.
export const Compact = {
  name: "Compact layout",
  args: { size: "sm" },
  render: (args) => <Card {...args} />,
  description: "Used in side panels.",
};
```

The default export is optional. `title` is `"Group/Name"`; the part before the last `/` is the navigation group, and it defaults to the file name. It can also set `component`, `args`, `description`, `fullscreen` (frames get the full viewport height) and `decorators`.

Each named export whose value is a component or an object is one frame, in export order. Its name is `name`, or the export name in sentence case (`WithAction` becomes "With action"). Other exported values are ignored.

## Editable parameters and motion

A default export or object frame can declare `controls` for primitive args. Each control is a number (`min`, `max`, optional `step`), boolean, or select (`options` with `value` and `label`). Optional `label` and `description` describe the field.

```tsx
export default {
  component: Surface,
  args: { opacity: 0.4, active: true, style: "quiet", time: 0 },
  controls: {
    opacity: { type: "number", min: 0, max: 1, step: 0.05 },
    active: { type: "boolean" },
    style: { type: "select", options: [{ value: "quiet", label: "Quiet" }] },
  },
  motion: { duration: 6, fps: 60, markers: [{ at: 2, label: "Arrival" }] },
  save: { file: "default.json", key: "values" },
};
export const Preview = {};
```

UI Canvas renders Parameters beside that frame. Edits update args without remounting; React input state and sibling frames survive. Reset restores the selected saved version's values. `motion` adds independent playback and scrubbing through the numeric `time` arg in seconds. Components should derive animation from `time` rather than the wall clock.

`save` is optional. Its `file` must be a kebab-case JSON filename beside the canvas, declared literally in the default export or frame. `key` optionally identifies the primitive value record inside the JSON object. Frames inherit it from the default export. The host resolves this declaration from the build manifest. Save updates that version; Save as new version copies its shape and metadata to a named sibling. A version must have the same keys and value types as the authored file. For a root value record without `key`, version labels are stored in Canvas review storage so labels never become parameters. Wrapped records keep their names in JSON. Temporary edits never write project source. Rebuilding edited source still reloads the affected canvas as usual.

## Project setup

An optional `.canvas/preview.tsx` applies to every canvas file in its folder and below; the nearest one wins. Use it for global CSS and providers:

```tsx
// .canvas/preview.tsx
import "../src/styles.css";
import { ThemeProvider } from "../src/theme";

export default {
  decorators: [
    (Frame, { theme }) => (
      <ThemeProvider mode={theme.mode}>
        <Frame />
      </ThemeProvider>
    ),
  ],
};
```

A decorator is `(Frame, context) => element`, where `context` is `{ theme, args }`. `theme` is the theme the host chose for the frame: `{ id, mode, tokens? }`, where `mode` is `"light"` or `"dark"` and `tokens` carries a theme's own values, such as a VS Code theme's. Canvas passes it through unchanged; apply it with your project's theme provider. Decorators run from the outside in: `.canvas/preview.tsx`, then the file's default export, then the frame.

## Types

Optional. Canvas files work without importing anything from this package.

```tsx
import type { CanvasFrame, CanvasMeta } from "@pstdio/canvas";

export default { title: "Components/Card", component: Card } satisfies CanvasMeta<typeof Card>;
export const Long: CanvasFrame<typeof Card> = { args: { title: "A much longer heading" } };
```
