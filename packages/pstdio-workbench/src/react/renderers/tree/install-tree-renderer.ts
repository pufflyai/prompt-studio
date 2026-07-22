import type { ResourceContextAction } from "@pstdio/ui";
import { createElement } from "react";
import type { WorkbenchCore } from "../../../core";
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
  workbench.renderers.setTreeRendererImplementation(({ workbench: scope, placement, treeId }) =>
    createElement(WorkbenchTreeView, {
      workbench: scope,
      treeViewId: treeId,
      resource: placement.resource,
      viewId: placement.contributionId,
      renderParamField: installation.renderParamField,
      onSidenavContextActionsChange:
        scope.layout.getWidget(placement.contributionId)?.region === "sidenav"
          ? installation.onSidenavContextActionsChange
          : undefined,
    }),
  );
};
