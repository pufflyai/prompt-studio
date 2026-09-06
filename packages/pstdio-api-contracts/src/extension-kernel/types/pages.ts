import type { Localizable } from "../l10n";
import type { ExtensionPanelRegion } from "./composition";
import type { ContributionDefinition, ModeRef, PageRef, PlacementRef, ViewRef } from "./contribution-identity";
import type { FileRendererSectionTarget } from "./file-renderer";
import type { ResourceConstraint } from "./resource-binding";
import type { ResourceRef } from "./resources";
import type { PlacementItem, PlacementPresentation } from "./views";

export type PageSlotRole = "primary" | "auxiliary";
export type PageSlotCardinality = "one" | "many";
export type PageOpenIntent = "preview" | "pin";
export type PageSlotRegion = ExtensionPanelRegion;

export interface PageMainView extends PlacementPresentation {
  readonly kind: "view";
  readonly view: ViewRef;
  readonly cardinality: PageSlotCardinality;
}

export interface PageMainPanels {
  readonly kind: "panels";
  readonly empty: ViewRef;
}

export type PageMain = PageMainView | PageMainPanels;

/** A page-owned panel. Main presentation and routed context belong to the page. */
export interface PageSlot extends PlacementPresentation {
  readonly id: string;
  readonly region: PageSlotRegion;
  readonly order?: number;
  readonly item: PlacementItem;
  readonly openOn?: "page-resource";
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
  readonly resource?: ResourceConstraint;
  readonly main: PageMain;
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
