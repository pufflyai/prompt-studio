import type { CommandTarget } from "./commands";
import type { PageRef } from "./contribution-identity";
import type { FileRendererSectionTarget } from "./file-renderer";
import type { JsonObject } from "./json";
import type { PageOpenIntent, PanelRef } from "./pages";
import type { ResourceRef } from "./resources";

export interface NavigationTargetPage {
  kind: "page";
  page: PageRef;
  resource?: ResourceRef;
  section?: FileRendererSectionTarget;
  open?: PageOpenIntent;
  parent?: NavigationTargetPage;
}

export interface NavigationTargetPanel {
  kind: "panel";
  panel: PanelRef;
  resource?: ResourceRef;
  open?: PageOpenIntent;
}

export interface NavigationTargetCommand {
  kind: "command";
  target: CommandTarget<JsonObject>;
}

export interface NavigationTargetHref {
  kind: "href";
  href: string;
}

export type NavigationTargetItem =
  | NavigationTargetPage
  | NavigationTargetPanel
  | NavigationTargetCommand
  | NavigationTargetHref;

export interface NavigationTargetCompound {
  kind: "compound";
  targets: readonly (NavigationTargetPage | NavigationTargetPanel)[];
}

export type NavigationTarget = NavigationTargetItem | NavigationTargetCompound;
