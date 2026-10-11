import { createElement } from "react";
import { getWorkbenchRenderers, type WorkbenchCore } from "../../../core";
import type { CommandParamFieldRenderer } from "../../command-palette/command-param-field";
import { WorkbenchControlsView } from "./controls-view";

// Track per-core installation so repeated <Workbench> renders are idempotent.
const installed = new WeakSet<WorkbenchCore>();

export const installWorkbenchControlsRenderer = (
  workbench: WorkbenchCore,
  options: { renderParamField?: CommandParamFieldRenderer } = {},
) => {
  if (installed.has(workbench)) return;
  installed.add(workbench);
  getWorkbenchRenderers(workbench).setControlsRendererImplementation(
    ({ workbench: scope, instance, controlsRendererId }) => {
      const contribution = getWorkbenchRenderers(scope).getControlsRenderer(controlsRendererId);
      if (!contribution) return null;
      return createElement(WorkbenchControlsView, {
        workbench: scope,
        contribution,
        placement: instance,
        renderParamField: options.renderParamField,
      });
    },
  );
};
