import { createDisposable, type Disposable } from "./shared/disposable";
import type { WorkbenchCore } from "./workbench-core-types";
import { createModuleContext, disposeDisposables, toDisposables } from "./workbench-module-context";

export const createWorkbenchModuleRegistry = (
  resolveCore: () => WorkbenchCore,
): Pick<WorkbenchCore, "registerModule" | "unregisterModule"> => {
  const moduleRecords = new Map<string, { disposable: Disposable }>();
  return {
    registerModule(module) {
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
  };
};
