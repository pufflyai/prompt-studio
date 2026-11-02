import type { Localizable } from "../l10n";
import type { ExtensionPanelRegion } from "./composition";
import type { ContributionDefinition, ModeRef, PageRef, PlacementRef, ViewRef } from "./contribution-identity";
import type { FileRendererSectionTarget } from "./file-renderer";
import type { ResourceConstraint } from "./resource-binding";
import type { ResourceRef } from "./resources";
import type { PlacementItem, PlacementPresentation, PlacementTabSnapshot } from "./views";

export type PageParamValue = string | number | boolean | readonly string[];
export type PageParamDefinition =
  | { readonly type: "string"; readonly default?: string; readonly values?: readonly string[] }
  | { readonly type: "number"; readonly default?: number }
  | { readonly type: "boolean"; readonly default?: boolean }
  | { readonly type: "string[]"; readonly default?: readonly string[] };
export type PageParams = Readonly<Record<string, PageParamValue>>;

export type PageSlotRole = "primary" | "auxiliary";
export type PageSlotCardinality = "one" | "many";
export type PageOpenIntent = "preview" | "pin";
export type PageSlotRegion = ExtensionPanelRegion;

export type PagePlaceholder =
  | ViewRef
  | {
      readonly view: ViewRef;
      /** Presentation for this page's current breadcrumb while Main is empty. */
      readonly breadcrumb?: Pick<PlacementTabSnapshot, "label" | "icon" | "menu">;
    };

export interface PageMainView extends PlacementPresentation {
  readonly kind: "view";
  readonly view: ViewRef;
  readonly cardinality: PageSlotCardinality;
  /** Render page content without tab controls, or normal tabs. Defaults to tabs. */
  readonly presentation?: "page" | "tabs";
  /** Custom content for an empty Main. */
  readonly empty?: PagePlaceholder;
}

export interface PageMainPanels {
  readonly kind: "panels";
  readonly empty?: PagePlaceholder;
  /** Static Main slot, independent static view, or many-resource Main viewer selected on navigation. */
  readonly landing?: string | PlacementRef;
}

/** A navigation parent without its own Main content. Opening it resolves to its default child. */
export interface PageMainGroup {
  readonly kind: "group";
  /** A child in the same mode that can open without a resource. */
  readonly default: PageRef;
}

export type PageMain = PageMainView | PageMainPanels | PageMainGroup;

/** A page-owned panel. Main presentation and routed context belong to the page. */
export interface PageSlot extends PlacementPresentation {
  readonly id: string;
  readonly region: PageSlotRegion;
  /** Regions whose Add menu and default placeholder offer this slot. Omit to offer it in every panel. */
  readonly addableIn?: readonly ExtensionPanelRegion[];
  /** @deprecated Use addableIn. This legacy value scopes Add choices, never tab movement. */
  readonly movableTo?: readonly ExtensionPanelRegion[];
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
  readonly mode: ModeRef;
  readonly parent?: PageRef;
  readonly resource?: ResourceConstraint;
  readonly document?: PageDocumentDeclaration;
  readonly params?: Readonly<Record<string, PageParamDefinition>>;
  /** @deprecated Main headers follow main.presentation. Auxiliary header defaults remain supported for existing pages. */
  readonly regionSettings?: Partial<Record<ExtensionPanelRegion, { readonly showHeader?: boolean }>>;
  readonly main: PageMain;
  /** Independent panel version of this page, using a normal static view or resource binding. */
  readonly panelView?: PlacementRef;
  readonly slots: readonly PageSlot[];
  readonly panels: Readonly<Record<string, PageSlotRef>>;
}

export type PlacementOwner =
  | { readonly kind: "shell"; readonly placementId: string }
  | { readonly kind: "mode"; readonly modeId: string; readonly placementId: string }
  | { readonly kind: "page"; readonly pageId: string; readonly slotId: string };

export type PlacementIdentity = PlacementOwner & { readonly instanceKey: string };

/** Viewer-owned navigation context and position, separate from resource identity. */
export interface ViewLocation {
  readonly pageContext?: Pick<PageLocation, "page" | "parent" | "params">;
  readonly section?: FileRendererSectionTarget;
  readonly position?: FileSourcePosition;
}

export interface PageLocation extends Pick<ViewLocation, "section" | "position"> {
  readonly page: PageRef;
  readonly resource?: ResourceRef;
  /** Overrides that differ from declared defaults. */
  readonly params?: PageParams;
  readonly parent?: PageLocation;
}
