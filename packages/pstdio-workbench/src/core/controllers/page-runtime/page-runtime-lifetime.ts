import { createDisposable, type Disposable } from "../../shared/disposable";
import { runWorkbenchEffect } from "../../shared/workbench-effect";

const runtimes = new WeakMap<object, Disposable>();

export const ownWorkbenchPageRuntime = (registry: object, connections: readonly Disposable[]) => {
  runtimes.set(
    registry,
    createDisposable(() => {
      for (const connection of [...connections].reverse())
        runWorkbenchEffect("page runtime connection disposal", () => connection.dispose());
    }),
  );
};

export const disposeWorkbenchPageRuntime = (registry: object) => {
  const runtime = runtimes.get(registry);
  runtimes.delete(registry);
  runtime?.dispose();
};
