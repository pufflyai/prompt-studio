import type { CommandTarget } from "./commands";
import type { PageRef, ViewRef } from "./contribution-identity";
import type { FileRendererSectionTarget } from "./file-renderer";
import type { JsonObject } from "./json";
import type { PageOpenIntent, PanelRef } from "./pages";
import type { ResourceRef } from "./resources";

export type ExtensionPlacementStrategy = "persistent" | "preview" | "replace-active" | "replace-invoking";
export type ExtensionResourcePlacementStrategy = Extract<ExtensionPlacementStrategy, "persistent" | "replace-active">;

export interface ExtensionResourceOpenIntent {
  strategy?: ExtensionResourcePlacementStrategy;
}

export interface ViewOpenIntent {
  strategy?: ExtensionPlacementStrategy;
}

export interface NavigationTargetResource {
  kind: "resource";
  resource: ResourceRef;
  input?: ExtensionResourceOpenIntent;
  section?: FileRendererSectionTarget;
}

export interface NavigationTargetView {
  kind: "view";
  view: ViewRef;
  input?: ViewOpenIntent;
}

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
  | NavigationTargetResource
  | NavigationTargetView
  | NavigationTargetCommand
  | NavigationTargetHref;

export interface NavigationTargetCompound {
  kind: "compound";
  targets: readonly NavigationTargetItem[];
}

export type NavigationTarget = NavigationTargetItem | NavigationTargetCompound;
