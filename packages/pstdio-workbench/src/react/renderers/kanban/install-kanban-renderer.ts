import { Spinner } from "@chakra-ui/react";
import { createElement, lazy, Suspense } from "react";
import { getWorkbenchRenderers, type WorkbenchCore } from "../../../core";
import type { CommandParamFieldRenderer } from "../../command-palette/command-params-dialog";

const WorkbenchKanbanView = lazy(() =>
  import("./kanban-view").then((module) => ({ default: module.WorkbenchKanbanView })),
);
const WorkbenchResourceListView = lazy(() =>
  import("../resource-list/install-resource-list-renderer").then((module) => ({
    default: module.renderWorkbenchResourceList,
  })),
);

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
      return createElement(
        Suspense,
        { fallback: createElement(Spinner) },
        createElement(
          contribution.presentation === "resourceList" ? WorkbenchResourceListView : WorkbenchKanbanView,
          props,
        ),
      );
    },
  );
};
