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

## Project setup

An optional `.canvas/preview.tsx` applies to every canvas file in its folder and below; the nearest one wins. Use it for global CSS and providers:

```tsx
// .canvas/preview.tsx
import "../src/styles.css";
import { ThemeProvider } from "../src/theme";

export default {
  decorators: [
    (Frame, { theme }) => (
      <ThemeProvider mode={theme}>
        <Frame />
      </ThemeProvider>
    ),
  ],
};
```

A decorator is `(Frame, context) => element`, where `context` is `{ theme, args }` and `theme` is `"light"` or `"dark"` from the frame's theme switch. Decorators run from the outside in: `.canvas/preview.tsx`, then the file's default export, then the frame.

## Types

Optional. Canvas files work without importing anything from this package.

```tsx
import type { CanvasFrame, CanvasMeta } from "@pstdio/canvas";

export default { title: "Components/Card", component: Card } satisfies CanvasMeta<typeof Card>;
export const Long: CanvasFrame<typeof Card> = { args: { title: "A much longer heading" } };
```
