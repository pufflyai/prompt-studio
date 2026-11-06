import type { CommandRef } from "./commands";
import type { PageRef } from "./contribution-identity";
import type { FileRendererSectionTarget } from "./file-renderer";
import type { JsonObject } from "./json";
import type { FileSourcePosition, PageOpenIntent, PageParams, PanelRef, ViewLocation } from "./pages";
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
  /** Return to this page's remembered Main location, falling back to its landing when that resource is shown elsewhere. */
  intent?: "open" | "restore";
}

/** Change only the invoking viewer. The host captures its identity before executing the action. */
export interface NavigationTargetViewer extends Pick<ViewLocation, "section" | "position"> {
  kind: "viewer";
  operation: "switch" | "replace";
  /** Expected current resource. Omit only for a resource-free Main landing. */
  from?: ResourceRef;
  resource: ResourceRef;
  /** Destination resource page when changing the current Main page content. */
  page?: PageRef;
}

/** Present a single-view page in a host modal without changing Main or browser history. */
export interface NavigationTargetDialog extends Pick<NavigationTargetPage, "page" | "resource" | "params"> {
  kind: "dialog";
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
  | NavigationTargetDialog
  | NavigationTargetPanel
  | NavigationTargetViewer
  | NavigationTargetCommand
  | NavigationTargetHref;

export interface NavigationTargetCompound {
  kind: "compound";
  targets: readonly (NavigationTargetPage | NavigationTargetPanel)[];
}

export type NavigationTarget = NavigationTargetItem | NavigationTargetCompound;
