import { type ComponentProps, lazy, Suspense } from "react";

const Editor = lazy(() => import("./diff-editor").then((module) => ({ default: module.DiffEditor })));

export const DiffEditor = (props: ComponentProps<typeof Editor>) => (
  <Suspense fallback={null}>
    <Editor {...props} />
  </Suspense>
);
