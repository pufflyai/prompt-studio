import { contributionRefId } from "@pstdio/sdk/extensions";
import {
  getActiveWorkbenchLocationPanel,
  getWorkbenchPanelForMenuRegion,
  isWorkbenchPanelPlacementVisible,
  matchesWorkbenchPanelMenuOwner,
  type WorkbenchCore,
  type WorkbenchPanelMenuRegion,
  type WorkbenchPanelRegion,
  type WorkbenchWidgetPlacement,
} from "../../core";
import { resourceMatchesConstraint } from "../../core/shared/contributions/reference-id";
import { resolveWorkbenchActivePanel } from "../shared/use-workbench-active-panel";

const resourceMenuVisible = (
  workbench: WorkbenchCore,
  panel: WorkbenchPanelRegion,
  selected: WorkbenchWidgetPlacement | undefined,
  menu: ReturnType<WorkbenchCore["viewMenus"]["getViewMenu"]>,
) => {
  if (menu?.purpose !== "resources") return true;
  if (panel === "main" && workbench.pages.getContent()?.widgetId === selected?.widgetId) return false;
  const config = menu.config;
  const page =
    config && typeof config === "object" && "pageId" in config && typeof config.pageId === "string"
      ? workbench.pages.store.getState().pages[config.pageId]
      : undefined;
  if (!page?.resource || !selected?.resource || !resourceMatchesConstraint(page.resource, selected.resource))
    return false;
  const pages = workbench.pages.listPages();
  const context = selected.pageContext?.page ?? selected.pageOwnerLocation?.page;
  const candidates = pages.filter(
    (candidate) =>
      candidate.modeId === workbench.modes.getActiveModeId() &&
      candidate.main.kind === "view" &&
      contributionRefId(candidate.main.view) === menu.ownerViewId &&
      candidate.resource &&
      resourceMatchesConstraint(candidate.resource, selected.resource!),
  );
  const owner =
    candidates.find((candidate) => context && contributionRefId(candidate.ref) === contributionRefId(context)) ??
    candidates.find((candidate) => workbench.navigationTrees.resolveOwner("page", candidate.id));
  return owner?.id === page.id;
};

/** Resolve menu content against its own panel's selected owner, including auxiliary resources. */
export const resolvePanelMenuRegionState = (workbench: WorkbenchCore, region: WorkbenchPanelMenuRegion) => {
  const panel = getWorkbenchPanelForMenuRegion(region);
  const state = workbench.layout.store.getState();
  const selected = resolveWorkbenchActivePanel(workbench, panel);
  const subPanel = selected?.role === "sub-panel" ? selected : undefined;
  const locationPanel = subPanel ? getActiveWorkbenchLocationPanel(state.layout) : selected;
  const current = state.layout.regions[region];
  return {
    ...current,
    widgets: current.widgets.filter((placement) => {
      const widget = state.widgets[placement.contributionId];
      const menuId =
        widget?.config && typeof widget.config === "object" && "viewContextId" in widget.config
          ? widget.config.viewContextId
          : undefined;
      const menu = typeof menuId === "string" ? workbench.viewMenus.getViewMenu(menuId) : undefined;
      if (!resourceMenuVisible(workbench, panel, selected, menu)) return false;
      return (
        widget &&
        (!placement.menuOwnerWidgetId || placement.menuOwnerWidgetId === selected?.widgetId) &&
        isWorkbenchPanelPlacementVisible(
          widget,
          workbench.getPrimaryResource(),
          workbench.modes.getActiveModeId(),
          placement,
          {
            ignoreResourceLocation: panel !== "main" || Boolean(placement.menuOwnerWidgetId),
            location: locationPanel,
          },
        ) &&
        matchesWorkbenchPanelMenuOwner(widget, { locationPanel, subPanel })
      );
    }),
  };
};
