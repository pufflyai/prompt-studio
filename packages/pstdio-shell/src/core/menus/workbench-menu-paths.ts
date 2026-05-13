import type { MenuPath } from "./menu-registry";

export const headerLeadingMenuPath = (area: string): MenuPath => ["workbench", "header", area, "leading"];

export const headerTrailingMenuPath = (area: string): MenuPath => ["workbench", "header", area, "trailing"];

export const workbenchCommandPaletteMenuPath = ["workbench", "commandPalette"] as const satisfies MenuPath;

export const workbenchTopHeaderLeadingMenuPath = headerLeadingMenuPath("top");

export const workbenchTopHeaderTrailingMenuPath = headerTrailingMenuPath("top");
