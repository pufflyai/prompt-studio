import { createElement } from "react";
import type { WorkbenchCore } from "../../../core";
import type { CommandParamFieldRenderer } from "../../command-palette/command-params-dialog";
import { WorkbenchTreeView } from "./tree-view";

interface InstallWorkbenchTreeRendererInput {
  renderParamField?: CommandParamFieldRenderer;
}

interface WorkbenchTreeRendererInstallation {
  renderParamField: CommandParamFieldRenderer | undefined;
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
    return;
  }

  const installation = { renderParamField: input.renderParamField };
  installed.set(workbench, installation);
  workbench.renderers.setTreeRendererImplementation(({ workbench: scope, placement, treeId }) =>
    createElement(WorkbenchTreeView, {
      workbench: scope,
      treeViewId: treeId,
      resource: placement.resource,
      renderParamField: installation.renderParamField,
    }),
  );
};
