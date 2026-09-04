import type { Localizable } from "../l10n";
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
  readonly label?: Localizable<string>;
  readonly icon?: string;
  readonly menuSlots?: readonly ResourceMenuSlotDefinition[];
}

export interface ResourceHierarchyProvider extends ContributionDefinition<"resource-hierarchy-provider"> {
  resourceKind: ResourceKindRef;
  parent(ctx: ExtensionContextBase, resource: ResourceRef): MaybePromise<ResourceRef | ViewHierarchyParent | null>;
}
