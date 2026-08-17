import type { CommandRef } from "./commands";
import type { FileRendererSectionTarget } from "./file-renderer";
import type { JsonObject } from "./json";
import type { ResourceRef } from "./resources";

export type ExtensionPlacementStrategy = "persistent" | "preview" | "replace-active" | "replace-invoking";
export type ExtensionResourcePlacementStrategy = Extract<ExtensionPlacementStrategy, "persistent" | "replace-active">;

export interface ExtensionResourceOpenIntent {
  strategy?: ExtensionResourcePlacementStrategy;
}

export interface ExtensionPanelOpenIntent {
  region?: string;
  strategy?: ExtensionPlacementStrategy;
}

export interface ExtensionNavigationTargetResource {
  kind: "resource";
  resource: ResourceRef;
  input?: ExtensionResourceOpenIntent;
  section?: FileRendererSectionTarget;
}

export interface ExtensionNavigationTargetPanel {
  kind: "panel";
  panel: string;
  input?: ExtensionPanelOpenIntent;
}

export interface ExtensionNavigationTargetCommand {
  kind: "command";
  command: CommandRef<JsonObject, unknown> | string;
  params?: JsonObject;
}

export type ExtensionNavigationTargetItem =
  | ExtensionNavigationTargetResource
  | ExtensionNavigationTargetPanel
  | ExtensionNavigationTargetCommand;

export interface ExtensionNavigationTargetCompound {
  kind: "compound";
  targets: ExtensionNavigationTargetItem[];
}

export type ExtensionNavigationTarget = ExtensionNavigationTargetItem | ExtensionNavigationTargetCompound;
