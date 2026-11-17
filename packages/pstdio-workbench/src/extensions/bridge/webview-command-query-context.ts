import type { WorkbenchCore } from "../../core";
import { isWorkbenchRetiring, registerWorkbenchRequiredWork } from "../../core/workbench-required-work";
import { runQueryCallbacks } from "./webview-query-cleanup";

const contexts = new WeakMap<WorkbenchCore, ReturnType<typeof createContext>>();
const createContext = (core: WorkbenchCore) => {
  const listeners = new Set<() => void>();
  const context = {
    id: crypto.randomUUID(),
    assertCurrent(projectId: string | undefined) {
      if (
        isWorkbenchRetiring(core) ||
        !core.activation.isActive() ||
        core.pages.store.getState().projectId !== projectId
      )
        throw new Error("Command query core is closed or inactive");
    },
    subscribeClose(listener: () => void) {
      if (isWorkbenchRetiring(core)) {
        listener();
        return () => {};
      }
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
  if (!isWorkbenchRetiring(core))
    registerWorkbenchRequiredWork(core, () => {
      const retiring = [...listeners];
      listeners.clear();
      runQueryCallbacks(retiring);
    });
  return context;
};

export const getWebviewCommandQueryContext = (core: WorkbenchCore) => {
  let context = contexts.get(core);
  if (!context) {
    context = createContext(core);
    contexts.set(core, context);
  }
  return context;
};
