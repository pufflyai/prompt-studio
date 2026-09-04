import type { Localizable } from "../l10n";
import type { ExtensionPanelRegion } from "./composition";
import type { RendererCallback } from "./context";
import type { ContributionDefinition, ModeRef, PageRef, ResourceKindRef, ViewRef } from "./contribution-identity";
import type { KanbanRendererContribution, WebviewContribution, WhenExpression } from "./contributions";
import type { ControlsRendererContribution } from "./controls";
import type { DataTableRendererContribution } from "./data-table-renderer";
import type { FileRendererContribution } from "./file-renderer";
import type { JsonObject, Struct } from "./json";
import type { NavigationTarget } from "./navigation-target";
import type { RendererEventReference } from "./renderer-base";
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

/**
 * Initial presence of a static placement inside its owner scope.
 * - "fixed": always open while the owner is active; the user cannot close it.
 * - "open": open when the owner has no saved state; the user may close it.
 * - "closed": closed until the user opens it (for example through the Add panel).
 * A saved user choice wins over "open" and "closed" on the next visit.
 */
export type PlacementPresence = "fixed" | "open" | "closed";

export type PlacementItem =
  | { readonly kind: "view"; readonly view: ViewRef; readonly presence: PlacementPresence }
  | {
      readonly kind: "binding";
      readonly resourceKind: ResourceKindRef | readonly ResourceKindRef[];
      readonly view: ViewRef;
      readonly cardinality: "one" | "many";
      /**
       * Action the Add panel runs to create or select a resource before the
       * placement can open. Without it the Add panel opens the placement with
       * the active resource when the kind matches.
       */
      readonly add?: NavigationTarget;
    };

export type PlacementMountStrategy = "active" | "keep-mounted";

export interface PlacementTabMenuRow {
  readonly id: string;
  readonly label: Localizable<string>;
  readonly icon?: string;
  readonly iconColor?: string;
  readonly selected?: boolean;
  readonly disabled?: boolean;
  readonly action?: NavigationTarget;
}

export interface PlacementTabMenuGroup {
  readonly id: string;
  readonly rows: readonly PlacementTabMenuRow[];
}

export interface PlacementTabSnapshot extends Struct {
  readonly label?: Localizable<string>;
  readonly icon?: string;
  readonly indicator?: {
    readonly icon: string;
    readonly color?: string;
    readonly label?: Localizable<string>;
  };
  readonly menu?: readonly PlacementTabMenuGroup[];
}

export interface PlacementTabPresentation {
  readonly query: RendererCallback<JsonObject, PlacementTabSnapshot>;
  readonly refreshEvents?: readonly RendererEventReference[];
}

export interface PlacementPresentation {
  readonly mountStrategy?: PlacementMountStrategy;
  readonly hiddenByDefault?: boolean;
  readonly headerBorderBottom?: boolean;
  readonly floatingPanels?: "visible" | "hidden";
  readonly tab?: PlacementTabPresentation;
}

export interface PlacementContribution extends ContributionDefinition<"placement">, PlacementPresentation {
  readonly mode: ModeRef;
  readonly item: PlacementItem;
  readonly region: ExtensionPanelRegion;
  readonly order?: number;
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
