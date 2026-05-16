import type { Disposable, WorkbenchCore } from "../../core";
import type { DynamicModuleController, DynamicModuleDefinition } from "./data";

export const createDynamicModuleController = (
  workbench: WorkbenchCore,
  definitions: DynamicModuleDefinition[],
): DynamicModuleController => {
  const registrations = new Map<string, Disposable>();
  const listeners = new Set<() => void>();

  const notify = () => {
    for (const listener of listeners) listener();
  };

  const getDefinition = (moduleId: string) => definitions.find((definition) => definition.id === moduleId)!;

  return {
    getEnabledModuleIds: () => [...registrations.keys()],

    setEnabled(moduleId, enabled) {
      const registration = registrations.get(moduleId);
      if (enabled && !registration) {
        const definition = getDefinition(moduleId);
        registrations.set(moduleId, workbench.registerModule(definition.createModule()));
        notify();
        return;
      }

      if (!enabled && registration) {
        registration.dispose();
        registrations.delete(moduleId);
        notify();
      }
    },

    subscribe(listener) {
      listeners.add(listener);
      return {
        dispose() {
          listeners.delete(listener);
        },
      };
    },
  };
};
