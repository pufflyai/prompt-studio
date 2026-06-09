import type { MenuPath } from "./menu-registry";

export const headerLeadingMenuPath = (area: string): MenuPath => ["workbench", "header", area, "leading"];

export const headerTrailingMenuPath = (area: string): MenuPath => ["workbench", "header", area, "trailing"];

export const workbenchCommandPaletteMenuPath = ["workbench", "commandPalette"] as const satisfies MenuPath;

export const workbenchTopHeaderLeadingMenuPath = headerLeadingMenuPath("nav");

export const workbenchTopHeaderTrailingMenuPath = headerTrailingMenuPath("nav");

export const resourceContextMenuPath = (resourceKind: string): MenuPath => [
  "workbench",
  "resource",
  resourceKind,
  "context",
];
