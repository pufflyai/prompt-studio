import { lazy, Suspense } from "react";
import type { DiffDrawerProps } from "./diff-drawer";
import type { DiffViewerProps } from "./diff-viewer";

const Drawer = lazy(() => import("./diff-drawer").then((module) => ({ default: module.DiffDrawer })));
const Viewer = lazy(() => import("./diff-viewer").then((module) => ({ default: module.DiffViewer })));

// Diff parsing loads its syntax languages. Keep it out of the initial workbench module graph.
export const DiffDrawer = (props: DiffDrawerProps) => (
  <Suspense fallback={null}>
    <Drawer {...props} />
  </Suspense>
);

export const DiffViewer = (props: DiffViewerProps) => (
  <Suspense fallback={null}>
    <Viewer {...props} />
  </Suspense>
);
