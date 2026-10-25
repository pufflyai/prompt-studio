import { createElement } from "react";
import { getWorkbenchRenderers, rendererReadKey, type WorkbenchCore } from "../../../core";
import type { CommandParamFieldRenderer } from "../../command-palette/command-params-dialog";
import type { SidenavContextActionsChange } from "../../shared/sidenav-context-actions";
import { WorkbenchTreeView } from "./tree-view";

interface InstallWorkbenchTreeRendererInput {
  renderParamField?: CommandParamFieldRenderer;
  onSidenavContextActionsChange?: SidenavContextActionsChange;
}

interface WorkbenchTreeRendererInstallation {
  renderParamField: CommandParamFieldRenderer | undefined;
  onSidenavContextActionsChange: SidenavContextActionsChange | undefined;
}

// Track per-core installation so repeated <Workbench> renders are idempotent.
const installed = new WeakMap<WorkbenchCore, WorkbenchTreeRendererInstallation>();

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
  getWorkbenchRenderers(workbench).setTreeRendererImplementation(({ workbench: scope, panel, instance, treeId }) =>
    createElement(WorkbenchTreeView, {
      workbench: scope,
      treeViewId: treeId,
      placement: instance,
      readOwnerKey: rendererReadKey(instance),
      resource: instance.resource,
      viewId: viewContextId(scope, instance.panelId, instance.viewId),
      renderParamField: installation.renderParamField,
      onSidenavContextActionsChange:
        panel.region === "sidenav" ? installation.onSidenavContextActionsChange : undefined,
    }),
  );
};
