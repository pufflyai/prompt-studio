import {
  type RegisteredWidgetContribution,
  type WorkbenchLayout,
  type WorkbenchPanelMenuRegion,
  type WorkbenchPanelMenuSide,
  type WorkbenchPanelRegion,
  workbenchPanelMenuRegions,
  workbenchPanelRegions,
} from "./layout-types";

type GetWidget = (contributionId: string) => RegisteredWidgetContribution | undefined;

const menuRegions = Object.values(workbenchPanelMenuRegions).flatMap(
  (regions) => Object.values(regions) as WorkbenchPanelMenuRegion[],
);

const menuSide = (region: WorkbenchPanelMenuRegion): WorkbenchPanelMenuSide =>
  region.endsWith("-left-menu") ? "left" : "right";

const ownerContributionId = (getWidget: GetWidget, contributionId: string) =>
  getWidget(contributionId)?.panelMenuOwner?.contributionId;

const panelRegionOf = (layout: WorkbenchLayout, contributionId: string) =>
  workbenchPanelRegions.find((region) =>
    layout.regions[region].widgets.some((placement) => placement.contributionId === contributionId),
  );

// A panel instance owns its menu instances: menus render beside the region their
// owner currently occupies, and a menu whose owner has no placement is an orphan.
// This reconciliation moves owned menus to the matching menu regions of the owner's
// current panel region and removes orphans. Menu identity (widget id, active state)
// is preserved on a move; no second instance is created.
export const reconcilePanelMenuOwnership = (layout: WorkbenchLayout, getWidget: GetWidget): WorkbenchLayout => {
  let changed = false;
  const regions = { ...layout.regions };
  const moves: {
    placement: WorkbenchLayout["regions"][WorkbenchPanelMenuRegion]["widgets"][number];
    target: WorkbenchPanelMenuRegion;
  }[] = [];

  for (const menuRegion of menuRegions) {
    const region = regions[menuRegion];
    if (region.widgets.length === 0) continue;
    const keep: typeof region.widgets = [];
    for (const placement of region.widgets) {
      const owner = ownerContributionId(getWidget, placement.contributionId);
      if (!owner) {
        keep.push(placement);
        continue;
      }
      const ownerRegion = panelRegionOf(layout, owner);
      if (!ownerRegion) {
        // Orphaned menu: its owner panel has no placement anywhere.
        changed = true;
        continue;
      }
      const target = workbenchPanelMenuRegions[ownerRegion as WorkbenchPanelRegion][menuSide(menuRegion)];
      if (target === menuRegion) {
        keep.push(placement);
        continue;
      }
      changed = true;
      moves.push({ placement, target });
    }
    if (keep.length !== region.widgets.length) {
      regions[menuRegion] = {
        ...region,
        widgets: keep,
        activeWidgetId: keep.some((placement) => placement.widgetId === region.activeWidgetId)
          ? region.activeWidgetId
          : undefined,
      };
    }
  }

  for (const move of moves) {
    const target = regions[move.target];
    regions[move.target] = { ...target, widgets: [...target.widgets, move.placement] };
  }

  return changed ? { ...layout, regions } : layout;
};
