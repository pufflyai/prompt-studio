import type { CommandRef } from "./commands";
import type { PageRef } from "./contribution-identity";
import type { FileRendererSectionTarget } from "./file-renderer";
import type { JsonObject } from "./json";
import type { FileSourcePosition, PageOpenIntent, PageParams, PanelRef } from "./pages";
import type { ResourceRef } from "./resources";

export interface NavigationTargetPage {
  kind: "page";
  page: PageRef;
  resource?: ResourceRef;
  section?: FileRendererSectionTarget;
  position?: FileSourcePosition;
  open?: PageOpenIntent;
  params?: PageParams;
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
  target: {
    command: CommandRef;
    params?: JsonObject;
  };
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
