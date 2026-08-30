import type { CommandTarget } from "./commands";
import type { PageRef, ViewRef } from "./contribution-identity";
import type { FileRendererSectionTarget } from "./file-renderer";
import type { JsonObject } from "./json";
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

// Navigation only targets pages, commands, and hrefs. A resource is never a
// destination: it travels as an argument on a page target and the page's bindings
// place it, so the caller's choice of page is the choice of presentation.
export interface NavigationTargetPage {
  kind: "page";
  page: PageRef;
  // Fills the page's bound slots for the resource's kind.
  resource?: ResourceRef;
  // Reveal: reopen this slot if closed and make its tab active.
  slot?: string;
  // `many` slots only; default "preview". "pin" inserts a persistent tab.
  open?: "preview" | "pin";
  // Deep-link into a file view of the opened instance.
  section?: FileRendererSectionTarget;
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
  | NavigationTargetResource
  | NavigationTargetView
  | NavigationTargetCommand
  | NavigationTargetHref;

export interface NavigationTargetCompound {
  kind: "compound";
  targets: readonly NavigationTargetItem[];
}

export type NavigationTarget = NavigationTargetItem | NavigationTargetCompound;
