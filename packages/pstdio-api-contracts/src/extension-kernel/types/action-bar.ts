import type { Localizable } from "../l10n";
import type { RendererCallback } from "./context";
import type { NavigationTarget } from "./navigation-target";
import type { RendererEventReference } from "./renderer-base";
import type { RendererContext } from "./resources";

export interface ActionBarAction {
  readonly id: string;
  readonly label: Localizable<string>;
  readonly icon?: string;
  readonly group?: string;
  readonly selected?: boolean;
  readonly disabled?: boolean;
  readonly action: NavigationTarget;
}

export interface ActionBarMenu {
  readonly id: string;
  readonly label: Localizable<string>;
  readonly icon?: string;
  readonly group?: string;
  readonly disabled?: boolean;
  readonly items: readonly ActionBarAction[];
}

export interface ActionBarSnapshot {
  readonly items: readonly (ActionBarAction | ActionBarMenu)[];
}

/** Native buttons and menus. The host owns overlays, focus and shared shortcut hints. */
export interface ActionBarViewBody {
  readonly kind: "actionBar";
  readonly orientation?: "vertical" | "horizontal";
  readonly query: RendererCallback<{ renderer: RendererContext }, ActionBarSnapshot>;
  readonly refreshEvents?: readonly RendererEventReference[];
}
