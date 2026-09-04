import { createElement } from "react";
import { getWorkbenchRenderers, type WorkbenchCore } from "../../../core";
import { WorkbenchKanbanView } from "./kanban-view";

// Track per-core installation so repeated <Workbench> renders are idempotent.
const installed = new WeakSet<WorkbenchCore>();

export const installWorkbenchKanbanRenderer = (workbench: WorkbenchCore) => {
  if (installed.has(workbench)) return;
  installed.add(workbench);
  getWorkbenchRenderers(workbench).setKanbanRendererImplementation(
    ({ workbench: scope, instance, kanbanRendererId }) => {
      const contribution = getWorkbenchRenderers(scope).getKanbanRenderer(kanbanRendererId);
      if (!contribution) return null;
      return createElement(WorkbenchKanbanView, { workbench: scope, contribution, placement: instance });
    },
  );
};
