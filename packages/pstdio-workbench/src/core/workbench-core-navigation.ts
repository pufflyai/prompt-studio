import { prepareWorkbenchNavigation } from "./controllers/navigation/compound-navigation";
import { openPageDialog } from "./controllers/navigation/page-dialog";
import { canOpenCorePanel } from "./controllers/navigation/panel-target";
import { resolveResourceTabTarget } from "./controllers/navigation/resource-page-tab";
import { currentViewerSource } from "./controllers/resource-viewers/viewer-source";
import type { WorkbenchRegion } from "./registries/layout/layout-model";
import {
  createNavigationRegistry,
  type NavigationInvocationContext,
} from "./registries/navigation/navigation-registry";
import type { WorkbenchCore } from "./workbench-core-types";

export const revealPanelRegion = (core: WorkbenchCore, region: WorkbenchRegion) => {
  if (region === "secondary" && !core.shell.getPanelPolicy("secondary").open) {
    core.shell.setRegionOpen("secondary", true);
  }
  if (region === "side" && core.sidePanel.getMode() === "closed") core.sidePanel.setMode("attached");
};

const sidePreviewSource = (core: WorkbenchCore, context?: NavigationInvocationContext) => {
  const identity = context?.viewer;
  const source = identity && currentViewerSource(core, identity);
  return source?.region === "side" && source.widget.tabRetention === "preview" ? source : undefined;
};

export const createCoreNavigationRegistry = (resolveCore: () => WorkbenchCore) =>
  createNavigationRegistry({
    getProjectId: () => resolveCore().pages.store.getState().projectId,
    resolveDispatcher: () => {
      const core = resolveCore();
      return {
        prepareNavigation: (targets, context) =>
          prepareWorkbenchNavigation(core, targets, {
            resourceTabs: true,
            previewSource: sidePreviewSource(core, context),
          }),
        canOpenPanel: (target) => canOpenCorePanel(core, target),
        canExecuteCommand: (commandId) => Boolean(core.commands.getCommand(commandId)),
        openPanelTarget: (target, context) =>
          prepareWorkbenchNavigation(core, [target], { previewSource: sidePreviewSource(core, context) }).commit(),
        openViewerTarget: (target, context) => {
          if (!context?.viewer) throw new Error("Viewer navigation requires a calling viewer");
          return core.viewers.change(context.viewer, target, context);
        },
        openDialogTarget: (target) => openPageDialog(core, target),
        openPageTarget: (target, context) => {
          const resolved = resolveResourceTabTarget(core, target, core.pages.store.getState(), { resourceTabs: true });
          if (resolved.target.kind === "panel")
            return prepareWorkbenchNavigation(core, [resolved.target], {
              location: resolved.location,
              previewSource: sidePreviewSource(core, context),
            }).commit();
          const result = core.pageLocations.navigate(resolved.target);
          if (!result.ok) throw new Error(result.diagnostic.message);
          return result;
        },
        executeCommand: (commandId, args, region, context) =>
          core.commands.executeCommand(commandId, args, {
            ...(region ? { region, source: "panel-add" as const } : {}),
            ...(context?.viewer ? { placement: context.viewer } : {}),
            ...(context?.projectId ? { projectId: context.projectId } : {}),
            removalVersion: context?.removalVersion,
            isViewerCurrent: context?.isViewerCurrent,
          }),
        openHref: (href) => globalThis.open(href, "_blank", "noopener,noreferrer"),
      };
    },
  });
