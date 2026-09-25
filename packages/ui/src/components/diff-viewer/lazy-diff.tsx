import { type ComponentProps, lazy, Suspense } from "react";

const Drawer = lazy(() => import("./diff-drawer").then((module) => ({ default: module.DiffDrawer })));
const Editor = lazy(() => import("./diff-editor").then((module) => ({ default: module.DiffEditor })));
const Viewer = lazy(() => import("./diff-viewer").then((module) => ({ default: module.DiffViewer })));

// Diff parsing loads its syntax languages. Keep it out of the initial workbench module graph.
export const DiffDrawer = (props: ComponentProps<typeof Drawer>) => (
  <Suspense fallback={null}>
    <Drawer {...props} />
  </Suspense>
);

export const DiffEditor = (props: ComponentProps<typeof Editor>) => (
  <Suspense fallback={null}>
    <Editor {...props} />
  </Suspense>
);

export const DiffViewer = (props: ComponentProps<typeof Viewer>) => (
  <Suspense fallback={null}>
    <Viewer {...props} />
  </Suspense>
);
