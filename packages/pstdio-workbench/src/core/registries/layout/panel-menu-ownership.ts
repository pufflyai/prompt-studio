import type { LayoutModel } from "./layout-model-types";
import {
  type RegisteredWidgetContribution,
  type WorkbenchLayout,
  type WorkbenchPanelMenuRegion,
  type WorkbenchPanelMenuSide,
  type WorkbenchPanelRegion,
  type WorkbenchWidgetPlacement,
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

const ownerPlacement = (layout: WorkbenchLayout, contributionId: string) => {
  for (const region of workbenchPanelRegions) {
    const placement = layout.regions[region].widgets.find((candidate) => candidate.contributionId === contributionId);
    if (placement) return { region, placement };
  }
  return undefined;
};

interface MenuResolution {
  placements: WorkbenchWidgetPlacement[];
  changed: boolean;
}

// One placement per owned menu contribution. A panel opened without a resource and
// then reopened with one would otherwise leave its first menu behind, because menu
// reuse keys on the owner's resource. Keeping the first placement and rebinding it
// preserves the menu's identity and active state.
const resolveMenuPlacements = (
  layout: WorkbenchLayout,
  getWidget: GetWidget,
  region: WorkbenchPanelMenuRegion,
): MenuResolution & { moves: { placement: WorkbenchWidgetPlacement; target: WorkbenchPanelMenuRegion }[] } => {
  const placements: WorkbenchWidgetPlacement[] = [];
  const moves: { placement: WorkbenchWidgetPlacement; target: WorkbenchPanelMenuRegion }[] = [];
  const seen = new Set<string>();
  let changed = false;

  for (const placement of layout.regions[region].widgets) {
    const owner = ownerContributionId(getWidget, placement.contributionId);
    if (!owner) {
      placements.push(placement);
      continue;
    }
    if (seen.has(placement.contributionId)) {
      changed = true;
      continue;
    }
    seen.add(placement.contributionId);

    const found = ownerPlacement(layout, owner);
    if (!found) {
      // Orphaned menu: its owner panel has no placement anywhere.
      changed = true;
      continue;
    }

    const bound =
      placement.ownerResourceUri === found.placement.resourceUri
        ? placement
        : { ...placement, ownerResourceUri: found.placement.resourceUri };
    if (bound !== placement) changed = true;

    const target = workbenchPanelMenuRegions[found.region as WorkbenchPanelRegion][menuSide(region)];
    if (target === region) {
      placements.push(bound);
      continue;
    }
    changed = true;
    moves.push({ placement: bound, target });
  }

  return { changed, moves, placements };
};

// A panel instance owns its menu instances: menus render beside the region their
// owner currently occupies, stay bound to the owner's resource, and a menu whose
// owner has no placement is an orphan. Menu identity (widget id, active state) is
// preserved on a move; no second instance is created.
export const reconcilePanelMenuOwnership = (layout: WorkbenchLayout, getWidget: GetWidget): WorkbenchLayout => {
  let changed = false;
  const regions = { ...layout.regions };
  const moves: { placement: WorkbenchWidgetPlacement; target: WorkbenchPanelMenuRegion }[] = [];

  for (const menuRegion of menuRegions) {
    if (layout.regions[menuRegion].widgets.length === 0) continue;
    const resolved = resolveMenuPlacements(layout, getWidget, menuRegion);
    moves.push(...resolved.moves);
    if (!resolved.changed) continue;

    changed = true;
    const region = regions[menuRegion];
    regions[menuRegion] = {
      ...region,
      widgets: resolved.placements,
      activeWidgetId: resolved.placements.some((placement) => placement.widgetId === region.activeWidgetId)
        ? region.activeWidgetId
        : undefined,
    };
  }

  for (const move of moves) {
    const target = regions[move.target];
    regions[move.target] = { ...target, widgets: [...target.widgets, move.placement] };
  }

  return changed ? { ...layout, regions } : layout;
};

export interface CreateOwnedMenuMethodsInput {
  getLayout(): WorkbenchLayout;
  getWidget: GetWidget;
  openWidget: LayoutModel["openWidget"];
  persistLayout(): void;
  setLayout(layout: WorkbenchLayout): void;
}

// Every open (including a region move or a rebind to a resource) reconciles the
// owned menus of the panel that moved, so a panel instance always has exactly one
// instance of each menu it owns.
export const createOwnedMenuMethods = (input: CreateOwnedMenuMethodsInput) => {
  const reconcilePanelMenus = () => {
    const next = reconcilePanelMenuOwnership(input.getLayout(), input.getWidget);
    if (next === input.getLayout()) return;
    input.setLayout(next);
    input.persistLayout();
  };

  const openWidget: LayoutModel["openWidget"] = (id, openInput) => {
    const placement = input.openWidget(id, openInput);
    reconcilePanelMenus();
    return placement;
  };

  return { openWidget, reconcilePanelMenus };
};
