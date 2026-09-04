import type { ResourceContextAction } from "@pstdio/ui";
import { createElement } from "react";
import { getWorkbenchRenderers, type WorkbenchCore } from "../../../core";
import type { CommandParamFieldRenderer } from "../../command-palette/command-params-dialog";
import { WorkbenchTreeView } from "./tree-view";

interface InstallWorkbenchTreeRendererInput {
  renderParamField?: CommandParamFieldRenderer;
  onSidenavContextActionsChange?: (actions: ResourceContextAction[]) => void;
}

interface WorkbenchTreeRendererInstallation {
  renderParamField: CommandParamFieldRenderer | undefined;
  onSidenavContextActionsChange: ((actions: ResourceContextAction[]) => void) | undefined;
}

// Track per-core installation so repeated <Workbench> renders are idempotent.
const installed = new WeakMap<WorkbenchCore, WorkbenchTreeRendererInstallation>();

const isSidenavPlacement = (workbench: WorkbenchCore, instanceId: string) =>
  workbench.layout.getLayout().regions.sidenav.widgets.some((placement) => placement.widgetId === instanceId);

const viewContextId = (workbench: WorkbenchCore, panelId: string, viewId: string | undefined) => {
  const config = workbench.layout.getPanel(panelId)?.config;
  if (config && typeof config === "object" && "viewContextId" in config) {
    const candidate = config.viewContextId;
    if (typeof candidate === "string") return candidate;
  }
  return viewId;
};

export const installWorkbenchTreeRenderer = (
  workbench: WorkbenchCore,
  input: InstallWorkbenchTreeRendererInput = {},
) => {
  const current = installed.get(workbench);
  if (current) {
    current.renderParamField = input.renderParamField;
    current.onSidenavContextActionsChange = input.onSidenavContextActionsChange;
    return;
  }

  const installation = {
    renderParamField: input.renderParamField,
    onSidenavContextActionsChange: input.onSidenavContextActionsChange,
  };
  installed.set(workbench, installation);
  getWorkbenchRenderers(workbench).setTreeRendererImplementation(({ workbench: scope, instance, treeId }) =>
    createElement(WorkbenchTreeView, {
      workbench: scope,
      treeViewId: treeId,
      resource: instance.resource,
      viewId: viewContextId(scope, instance.panelId, instance.viewId),
      renderParamField: installation.renderParamField,
      onSidenavContextActionsChange: isSidenavPlacement(scope, instance.instanceId)
        ? installation.onSidenavContextActionsChange
        : undefined,
    }),
  );
};
