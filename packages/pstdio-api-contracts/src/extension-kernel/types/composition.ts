import type { Localizable } from "../l10n";
import type { ExtensionContextBase } from "./context";
import type { ContributionDefinition, ResourceKindRef, ResourceSlotRef, ViewRef } from "./contribution-identity";
import type { MaybePromise } from "./json";
import type { ResourceRef, ViewHierarchyParent } from "./resources";

export const dockedWorkbenchRegions = ["sidenav", "main", "secondary", "side"] as const;
export type DockedWorkbenchRegion = (typeof dockedWorkbenchRegions)[number];

export type ResourceSurface = "primary" | "secondary" | "attached";
export type ResourceSlotCardinality = "one" | "many";

export interface ResourceSlotDefinition {
  readonly id: string;
  readonly cardinality: ResourceSlotCardinality;
  readonly access: "owner" | "public";
}

export interface ResourceKindDefinition extends ContributionDefinition<"resource-kind"> {
  readonly surface: ResourceSurface;
  readonly label?: Localizable<string>;
  readonly icon?: string;
  readonly slots?: readonly ResourceSlotDefinition[];
}

export interface ResourceViewContribution extends ContributionDefinition<"resource-view"> {
  readonly resourceKind: ResourceKindRef;
  readonly slot: ResourceSlotRef;
  readonly view: ViewRef;
  readonly order?: number;
}

export interface ResourceHierarchyProvider extends ContributionDefinition<"resource-hierarchy-provider"> {
  resourceKind: ResourceKindRef;
  parent(ctx: ExtensionContextBase, resource: ResourceRef): MaybePromise<ResourceRef | ViewHierarchyParent | null>;
}
