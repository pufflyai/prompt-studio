import type { Localizable } from "../l10n";
import type { ExtensionPanelRegion } from "./composition";
import type { ContributionDefinition, ModeRef, PageRef, ResourceSlotRef, ViewRef } from "./contribution-identity";
import type { KanbanRendererContribution, WebviewContribution, WhenExpression } from "./contributions";
import type { ControlsRendererContribution } from "./controls";
import type { DataTableRendererContribution } from "./data-table-renderer";
import type { FileRendererContribution } from "./file-renderer";
import type { NavigationTarget } from "./navigation-target";
import type { TreeRendererContribution } from "./tree-renderer";

type NativeViewBody<Kind extends string, Definition> = { readonly kind: Kind } & Omit<
  Definition,
  "title" | "icon" | "resourceKind"
>;

export type WebviewViewBody = { readonly kind: "webview" } & WebviewContribution;
export type TreeViewBody = NativeViewBody<"tree", TreeRendererContribution>;
export type FileViewBody = NativeViewBody<"file", FileRendererContribution>;
export type ControlsViewBody = NativeViewBody<"controls", ControlsRendererContribution>;
export type KanbanViewBody = NativeViewBody<"kanban", KanbanRendererContribution>;
export type DataTableViewBody = NativeViewBody<"dataTable", DataTableRendererContribution>;

export type ViewBody =
  | WebviewViewBody
  | TreeViewBody
  | FileViewBody
  | ControlsViewBody
  | KanbanViewBody
  | DataTableViewBody;

export interface ViewContribution extends ContributionDefinition<"view"> {
  readonly title: Localizable<string>;
  readonly icon?: string;
  readonly path?: string;
  readonly body: ViewBody;
}

export type NavigationOwnerRef = ModeRef | PageRef;
export type NavigationTreeSlot = "header" | "content" | "footer";

export interface NavigationItemContribution extends ContributionDefinition<"navigation-item"> {
  readonly owner: NavigationOwnerRef;
  readonly slot?: NavigationTreeSlot;
  readonly label: Localizable<string>;
  readonly icon?: string;
  readonly group?: string;
  readonly when?: WhenExpression;
  readonly action: NavigationTarget;
}

export interface NavigationTreeContribution extends ContributionDefinition<"navigation-tree"> {
  readonly owner: NavigationOwnerRef;
  readonly slot?: NavigationTreeSlot;
  readonly view: ViewRef;
}

export type PlacementItem =
  | { readonly kind: "view"; readonly view: ViewRef }
  | { readonly kind: "resource-slot"; readonly slot: ResourceSlotRef };

export interface PlacementContribution extends ContributionDefinition<"placement"> {
  readonly mode: ModeRef;
  readonly item: PlacementItem;
  readonly region: ExtensionPanelRegion;
  readonly order?: number;
  readonly defaultOpen?: boolean;
  readonly required?: boolean;
  readonly movableTo?: readonly ExtensionPanelRegion[];
}

export interface ViewMenuContribution extends ContributionDefinition<"view-menu"> {
  readonly owner: ViewRef;
  readonly view: ViewRef;
  readonly side: "left" | "right";
  readonly group?: string;
  readonly placement?: "first" | "default" | "last";
  readonly hostTreeHeader?: "default" | "none";
  readonly hostTreeFooter?: "default" | "none";
}
