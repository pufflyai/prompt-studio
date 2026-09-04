import type { PaletteMode } from "@pstdio/ui";
import { Search, Terminal } from "lucide-react";
import type { WorkbenchCommandPaletteView } from "../../core";
import { WorkbenchIcon } from "../shared/icon";

export const SEARCH_MODE_ID = "search";
export const COMMAND_MODE_ID = "command";
export const THEME_MODE_ID = "theme";

export const workbenchPaletteModes: PaletteMode[] = [{ id: SEARCH_MODE_ID }, { id: COMMAND_MODE_ID, inputPrefix: ">" }];

export const isThemePaletteView = (view: WorkbenchCommandPaletteView) => view === THEME_MODE_ID;

export const isPickerPaletteView = isThemePaletteView;

export const getPaletteViewMode = (view: WorkbenchCommandPaletteView) => {
  if (isThemePaletteView(view)) return THEME_MODE_ID;
  return undefined;
};

export const getPaletteViewModes = (view: WorkbenchCommandPaletteView) => {
  if (isPickerPaletteView(view)) return undefined;

  return workbenchPaletteModes;
};

export const getPaletteInitialActiveIndex = (input: {
  view: WorkbenchCommandPaletteView;
  themeInitialActiveIndex: number;
}) => {
  if (isThemePaletteView(input.view)) return input.themeInitialActiveIndex;

  return 0;
};

export const getPaletteInputIcon = (input: { view: WorkbenchCommandPaletteView; mode: string | undefined }) => {
  if (isThemePaletteView(input.view)) return <WorkbenchIcon name="Palette" size={16} />;
  if (input.mode === COMMAND_MODE_ID) return <Terminal size={16} aria-hidden="true" />;

  return <Search size={16} aria-hidden="true" />;
};

export const getPalettePlaceholder = (input: { view: WorkbenchCommandPaletteView; mode: string | undefined }) => {
  if (isThemePaletteView(input.view)) return "Search themes";
  if (input.mode === COMMAND_MODE_ID) return "Run command";

  return "Search resources";
};
