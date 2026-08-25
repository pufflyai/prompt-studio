import type { Localizable } from "../l10n";
import type { CommandRef } from "./commands";
import type { ExtensionContextBase } from "./context";
import type { MaybePromise } from "./json";
import type { ResourceRef, ViewHierarchyParent } from "./resources";

export const dockedWorkbenchRegions = ["sidenav", "main", "secondary", "side"] as const;
export type DockedWorkbenchRegion = (typeof dockedWorkbenchRegions)[number];

export type ResourceSurface = "primary" | "secondary" | "attached";
export type ResourceSlotCardinality = "one" | "many";

export interface ResourceSlotContribution {
  cardinality: ResourceSlotCardinality;
  external: boolean;
}

export interface ResourceKindContribution {
  surface: ResourceSurface;
  label?: Localizable<string>;
  icon?: string;
  slots: Record<string, ResourceSlotContribution>;
}

export interface ResourcePanelContribution {
  /** Cross-extension binding into a slot owned by the target resource kind. */
  resourceKind: string;
  panel: string;
  slot: string;
}

export interface ModePlacementContribution {
  region: DockedWorkbenchRegion;
  allowedRegions?: readonly DockedWorkbenchRegion[];
  required?: boolean;
  defaultOpen?: boolean;
  pinned?: boolean;
}

export interface PanelPlacementContribution {
  /** Resource kind this panel presents. Omit for a mode-wide panel. */
  for?: string;
  region: DockedWorkbenchRegion;
  /** Regions a mode may move this panel to. Defaults to the declared region. */
  allowedRegions?: readonly DockedWorkbenchRegion[];
  required?: boolean;
}

export interface ModeResourceRecipeContribution {
  slots?: Record<string, ModePlacementContribution>;
  panels?: Record<string, ModePlacementContribution>;
}

export type ModeDefaultResource = ResourceRef | { commandId: string } | CommandRef<Record<string, never>, ResourceRef>;

export interface WorkbenchNavigationTarget {
  modeId?: string;
  resource?: ResourceRef;
  replaceActive?: boolean;
}

export interface ResourceHierarchyProvider {
  resourceKind: string;
  parent(ctx: ExtensionContextBase, resource: ResourceRef): MaybePromise<ResourceRef | ViewHierarchyParent | null>;
}
