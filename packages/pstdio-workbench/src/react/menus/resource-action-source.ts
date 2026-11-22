import type { ResourceRef, WorkbenchCommandExecutionContext, WorkbenchCore } from "../../core";
import { subscribeResourceActionChanges } from "./resource-action-menu";
import { createWorkbenchResourceActions } from "./resource-actions";

/** Bridge imperative registries to React with an immutable snapshot that changes on owner notifications. */
export const createResourceActionSource = (
  workbench: WorkbenchCore,
  resource: ResourceRef | undefined,
  context: WorkbenchCommandExecutionContext,
) => {
  const inputs = () => [
    workbench.resources.preview.store.getState().changes,
    workbench.resources.store.getState().kinds,
    workbench.commands.store.getState().commands,
    workbench.context.store.getState().values,
    workbench.layout.menuStore.getState().itemsByPath,
  ];
  let current: unknown[] | undefined;
  let value: ReturnType<typeof createWorkbenchResourceActions> = [];
  const getSnapshot = () => {
    const next = inputs();
    if (!current || next.some((input, index) => input !== current?.[index])) {
      current = next;
      value = resource ? createWorkbenchResourceActions(workbench, resource, { context }) : [];
    }
    return value;
  };
  return {
    getSnapshot,
    subscribe(listener: () => void) {
      return subscribeResourceActionChanges(workbench, () => {
        // A kind can notify without replacing its registration object.
        current = undefined;
        listener();
      });
    },
  };
};
