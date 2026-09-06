import type { Localizable } from "../l10n";
import type { ExtensionPanelRegion } from "./composition";
import type {
  ContributionDefinition,
  ModeRef,
  PageRef,
  PlacementRef,
  ResourceKindRef,
  ViewRef,
} from "./contribution-identity";
import type { FileRendererSectionTarget } from "./file-renderer";
import type { NavigationTarget } from "./navigation-target";
import type { ResourceRef } from "./resources";
import type { PlacementPresence, PlacementPresentation } from "./views";

export type PageSlotRole = "primary" | "auxiliary";
export type PageSlotCardinality = "one" | "many";
export type PageOpenIntent = "preview" | "pin";
export type PageSlotRegion = ExtensionPanelRegion;

export interface PageSlotBinding {
  readonly kind: ResourceKindRef | readonly ResourceKindRef[];
  readonly view: ViewRef;
  readonly cardinality: PageSlotCardinality;
  /**
   * Action the Add panel runs to create or select a resource before the slot
   * can open. Without it the Add panel opens the slot with the active
   * resource when the kind matches.
   */
  readonly add?: NavigationTarget;
}

interface PageSlotBase extends PlacementPresentation {
  readonly id: string;
  readonly region: PageSlotRegion;
  readonly order?: number;
}

/**
 * The page's routed content. Always present while the page is open; the user
 * cannot hide the slot itself. With a binding, each opened resource becomes
 * an instance. A primary declares either a static view or a resource binding.
 */
interface PagePrimarySlotBase extends Omit<PageSlotBase, "region"> {
  readonly role: "primary";
  readonly region: "main";
}

export type PagePrimarySlot = PagePrimarySlotBase &
  (
    | { readonly view: ViewRef; readonly binding?: undefined }
    | { readonly view?: undefined; readonly binding: PageSlotBinding }
  );

/** An optional static panel the page owns. `presence` sets its initial state. */
export interface PageStaticSlot extends PageSlotBase {
  readonly role: "auxiliary";
  readonly view: ViewRef;
  readonly presence: PlacementPresence;
  readonly binding?: undefined;
}

/**
 * A resource-bound panel the page owns. It has no initial visibility: an
 * instance opens only when an action supplies a resource. `openOn:
 * "page-resource"` also opens it for the page's own resource when the kind
 * matches.
 */
export interface PageBoundSlot extends PageSlotBase {
  readonly role: "auxiliary";
  readonly binding: PageSlotBinding;
  readonly view?: undefined;
  readonly openOn?: "page-resource";
}

export type PageSlot = PagePrimarySlot | PageStaticSlot | PageBoundSlot;

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
