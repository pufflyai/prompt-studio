import type { Localizable } from "../l10n";
import type { CommandRef } from "./commands";
import type { ExtensionContextBase } from "./context";
import type { ContributionDefinition, ResourceKindRef } from "./contribution-identity";
import type { MaybePromise } from "./json";
import type { ResourceRef, ViewHierarchyParent } from "./resources";

export const dockedWorkbenchRegions = ["sidenav", "main", "secondary", "side"] as const;
export type DockedWorkbenchRegion = (typeof dockedWorkbenchRegions)[number];
export const extensionPanelRegions = ["main", "secondary", "side"] as const;
export type ExtensionPanelRegion = (typeof extensionPanelRegions)[number];

export interface RegionSize {
  readonly defaultPx?: number;
  readonly minPx?: number;
  readonly maxPx?: number;
}

export interface ResourceMenuSlotDefinition {
  readonly id: string;
  readonly placement: "header-primary" | "header-overflow" | "context-menu";
  readonly label?: Localizable<string>;
  readonly access: "owner" | "public";
  readonly order?: number;
}

export interface ResourceKindDefinition extends ContributionDefinition<"resource-kind"> {
  readonly prefix?: string | { readonly $prefix: "project" };
  readonly label?: Localizable<string>;
  readonly icon?: string;
  readonly menuSlots?: readonly ResourceMenuSlotDefinition[];
  /**
   * A command of this extension that returns the current reference for an open
   * resource, or null. The host runs it with `ctx.resource` set to the open
   * resource when the page opens and after the extension emits an event, and
   * shows the returned label, icon, and metadata. Keep metadata the page owns,
   * such as a selected document, from `ctx.resource`.
   */
  readonly resolve?: CommandRef;
  /** Resolve params.resources as a bounded ResourceRef[] batch. Return ResourceResolution[] with owner navigation; omit missing resources. */
  readonly resolveMany?: CommandRef;
  /** Validate an explicit anchor change. Return ResourceAnchorValidationResult. Must not mutate links. */
  readonly validateAnchors?: CommandRef;
}

export interface ResourceHierarchyProvider extends ContributionDefinition<"resource-hierarchy-provider"> {
  resourceKind: ResourceKindRef;
  parent(ctx: ExtensionContextBase, resource: ResourceRef): MaybePromise<ResourceRef | ViewHierarchyParent | null>;
}
