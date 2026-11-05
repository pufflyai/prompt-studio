import { createElement } from "react";
import { getWorkbenchRenderers, type WorkbenchCore } from "../../../core";
import type { CommandParamFieldRenderer } from "../../command-palette/command-params-dialog";
import { renderWorkbenchResourceList } from "../resource-list/install-resource-list-renderer";
import { WorkbenchKanbanView } from "./kanban-view";

// Track per-core installation so repeated <Workbench> renders are idempotent.
const installed = new WeakSet<WorkbenchCore>();

export const installWorkbenchKanbanRenderer = (
  workbench: WorkbenchCore,
  options: { renderParamField?: CommandParamFieldRenderer } = {},
) => {
  if (installed.has(workbench)) return;
  installed.add(workbench);
  getWorkbenchRenderers(workbench).setKanbanRendererImplementation(
    ({ workbench: scope, instance, kanbanRendererId }) => {
      const contribution = getWorkbenchRenderers(scope).getKanbanRenderer(kanbanRendererId);
      if (!contribution) return null;
      const props = {
        workbench: scope,
        contribution,
        placement: instance,
        renderParamField: options.renderParamField,
      };
      return contribution.presentation === "resourceList"
        ? renderWorkbenchResourceList(props)
        : createElement(WorkbenchKanbanView, props);
    },
  );
};
