import type { Localizable } from "../l10n";
import type { ExtensionPanelRegion, RegionSize } from "./composition";
import type { ContributionDefinition, ModeRef, PageRef, PlacementRef, ViewRef } from "./contribution-identity";
import type { FileRendererSectionTarget } from "./file-renderer";
import type { ResourceConstraint } from "./resource-binding";
import type { ResourceRef } from "./resources";
import type { PlacementItem, PlacementPresentation } from "./views";

export type PageSlotRole = "primary" | "auxiliary";
export type PageSlotCardinality = "one" | "many";
export type PageOpenIntent = "preview" | "pin";
export type PageSlotRegion = ExtensionPanelRegion | "bottom";

/** A headerless menu bound to the page resource, independent of its selected tab. */
export interface PanelMenuDeclaration {
  readonly view: ViewRef;
  readonly size?: RegionSize;
  readonly collapsible?: boolean;
  readonly hiddenByDefault?: boolean;
}

export interface PageRegionSettings {
  readonly showHeader?: boolean;
  readonly size?: RegionSize;
  readonly collapsible?: boolean;
  readonly alwaysShowTabs?: boolean;
}

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
  /** @deprecated For Side and Secondary, use mode placements. Page Main and bottom remain supported. */
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

/** Projects the selected document from resource metadata into page URLs. */
export interface PageDocumentDeclaration {
  readonly metadataKey: string;
}

/** One-based source coordinates. Owners clamp them to the loaded document. */
export interface FileSourcePosition {
  readonly line: number;
  readonly column?: number;
  readonly endLine?: number;
  readonly endColumn?: number;
}

export interface PageContribution extends ContributionDefinition<"page"> {
  readonly title: Localizable<string>;
  readonly icon?: string;
  readonly path: string;
  /** @deprecated Use modes for page availability. Without modes, keeps singleton navigation. */
  readonly mode: ModeRef;
  /** Non-empty, unique list of allowed modes. Authoritative when supplied. */
  readonly modes?: readonly ModeRef[];
  readonly parent?: PageRef;
  readonly resource?: ResourceConstraint;
  readonly document?: PageDocumentDeclaration;
  readonly main: PageMain;
  readonly panelMenus?: { readonly left?: PanelMenuDeclaration; readonly right?: PanelMenuDeclaration };
  readonly regionSettings?: { readonly bottom?: PageRegionSettings };
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
  /** The mode in which this page was opened. */
  readonly mode?: ModeRef;
  readonly resource?: ResourceRef;
  readonly section?: FileRendererSectionTarget;
  readonly position?: FileSourcePosition;
  readonly parent?: PageLocation;
}
