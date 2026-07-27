import { createElement } from "react";
import type { WorkbenchCore } from "../../../core";
import { WorkbenchKanbanView } from "./kanban-view";

// Track per-core installation so repeated <Workbench> renders are idempotent.
const installed = new WeakSet<WorkbenchCore>();

export const installWorkbenchKanbanRenderer = (workbench: WorkbenchCore) => {
  if (installed.has(workbench)) return;
  installed.add(workbench);
  workbench.renderers.setKanbanRendererImplementation(({ workbench: scope, instance, kanbanRendererId }) => {
    const contribution = scope.renderers.getKanbanRenderer(kanbanRendererId);
    if (!contribution) return null;
    return createElement(WorkbenchKanbanView, { workbench: scope, contribution, placement: instance });
  });
};
