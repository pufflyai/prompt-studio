import type { MenuPath } from "./menu-registry";

export const headerLeadingMenuPath = (region: string): MenuPath => ["workbench", "header", region, "leading"];

export const headerTrailingMenuPath = (region: string): MenuPath => ["workbench", "header", region, "trailing"];

export const workbenchRegionTabLeadingMenuPath = (region: string): MenuPath => [
  "workbench",
  "regionTabs",
  region,
  "leading",
];

export const workbenchRegionTabAddMenuPath = (region: string): MenuPath => ["workbench", "regionTabs", region, "add"];

export const workbenchCommandPaletteMenuPath = ["workbench", "commandPalette"] as const satisfies MenuPath;

export const workbenchTopHeaderLeadingMenuPath = headerLeadingMenuPath("nav");

export const workbenchTopHeaderTrailingMenuPath = headerTrailingMenuPath("nav");

// Actions on the current location, such as copying its link. Resource row menus never show them,
// because a row's location is not the current page.
export const workbenchBreadcrumbLocationMenuPath = ["workbench", "breadcrumb", "location"] as const satisfies MenuPath;

export const resourceContextMenuPath = (resourceKind: string): MenuPath => [
  "workbench",
  "resource",
  resourceKind,
  "context",
];
