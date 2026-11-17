import { createDisposable, type Disposable } from "./shared/disposable";
import { runWorkbenchEffect } from "./shared/workbench-effect";
import type { WorkbenchCore } from "./workbench-core-types";
import { createModuleContext, disposeDisposables, toDisposables } from "./workbench-module-context";

export const createWorkbenchModuleRegistry = (
  resolveCore: () => WorkbenchCore,
): Pick<WorkbenchCore, "registerModule" | "unregisterModule"> & Disposable & { close(): void } => {
  const moduleRecords = new Map<string, { disposable: Disposable }>();
  let disposed = false;
  let closed = false;
  return {
    close() {
      closed = true;
    },
    registerModule(module) {
      if (closed) throw new Error("Workbench is disposed");
      if (moduleRecords.has(module.id)) throw new Error(`Workbench module already registered: ${module.id}`);

      const disposables: Disposable[] = [];
      let registration: Disposable;

      registration = createDisposable(() => {
        if (moduleRecords.get(module.id)?.disposable !== registration) return;
        moduleRecords.delete(module.id);
        disposeDisposables(disposables);
      });

      const record = { disposable: registration };

      moduleRecords.set(module.id, record);

      try {
        const context = createModuleContext(resolveCore(), {
          contextScopeId: `module:${module.id}`,
          ownerId: module.ownerId ?? module.id,
          source: module.source ?? "module",
          track: (disposable) => {
            disposables.push(disposable);
          },
        });
        disposables.push(...toDisposables(module.activate(context)));
      } catch (error) {
        record.disposable.dispose();
        throw error;
      }

      return record.disposable;
    },

    unregisterModule(moduleId) {
      moduleRecords.get(moduleId)?.disposable.dispose();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      closed = true;
      for (const record of [...moduleRecords.values()].reverse())
        runWorkbenchEffect("module disposal", () => record.disposable.dispose());
      moduleRecords.clear();
    },
  };
};
