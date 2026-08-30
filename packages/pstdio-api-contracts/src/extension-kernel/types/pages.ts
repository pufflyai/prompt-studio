import type { Localizable } from "../l10n";
import type { DockedWorkbenchRegion } from "./composition";
import type {
  ContributionDefinition,
  ModeRef,
  PageRef,
  PlacementRef,
  ResourceKindRef,
  ViewRef,
} from "./contribution-identity";
import type { FileRendererSectionTarget } from "./file-renderer";
import type { ResourceRef } from "./resources";

export type PageSlotRole = "primary" | "auxiliary";
export type PageSlotCardinality = "one" | "many";
export type PageOpenIntent = "preview" | "pin";

export interface PageSlotBinding {
  readonly kind: ResourceKindRef;
  readonly view: ViewRef;
}

export interface PageSlot {
  readonly id: string;
  readonly role: PageSlotRole;
  readonly region: DockedWorkbenchRegion;
  readonly view?: ViewRef;
  readonly binding?: PageSlotBinding;
  readonly cardinality?: PageSlotCardinality;
  readonly closable?: boolean;
  readonly defaultOpen?: boolean;
  readonly defaultResource?: ResourceRef;
  readonly order?: number;
}

export interface PageSlotRef {
  readonly kind: "page-slot";
  readonly page: PageRef;
  readonly id: string;
}

export type PanelRef = PlacementRef | PageSlotRef;

export interface PageContribution extends ContributionDefinition<"page"> {
  readonly title: Localizable<string>;
  readonly icon?: string;
  readonly path: string;
  readonly mode: ModeRef;
  readonly parent?: PageRef;
  readonly slots: readonly PageSlot[];
  readonly panels: Readonly<Record<string, PageSlotRef>>;
}

export type PlacementOwner =
  | { readonly kind: "shell"; readonly placementId: string }
  | { readonly kind: "mode"; readonly modeId: string; readonly placementId: string }
  | { readonly kind: "page"; readonly pageId: string; readonly slotId: string };

export type PlacementIdentity = PlacementOwner & { readonly instanceKey: string };

export interface PageLocation {
  readonly page: PageRef;
  readonly resource?: ResourceRef;
  readonly section?: FileRendererSectionTarget;
  readonly parent?: PageLocation;
}
