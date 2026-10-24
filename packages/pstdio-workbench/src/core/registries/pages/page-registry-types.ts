import type {
  DockedWorkbenchRegion,
  FileRendererSectionTarget,
  FileSourcePosition,
  Localizable,
  PageContribution,
  PageDocumentDeclaration,
  PageLocation,
  PageMain,
  PageOpenIntent,
  PageParamDefinition,
  PageRef,
  PageSlot,
  PageSlotRole,
  PlacementIdentity,
  ResourceConstraint,
  ResourceRef,
  ViewLocation,
  ViewRef,
} from "@pstdio/sdk/extensions";
import type { WorkbenchStore } from "../../shared/store/workbench-store";
import type { WorkbenchTabSnapshot } from "../layout/layout-types";
import type { OwnedPlacementReconciliation, ResolvedOwnedPlacement } from "../layout/placement-reconciliation";
import type { WorkbenchPlacementPresentation } from "../views/view-placement";

export interface WorkbenchPageSlot extends Omit<PageSlot, "tab"> {
  readonly isAvailable?: (resource: ResourceRef | undefined) => boolean;
  readonly tab?: WorkbenchPlacementPresentation["tab"];
}

export type WorkbenchPagePlaceholder =
  | ViewRef
  | { readonly view: ViewRef; readonly breadcrumb?: Pick<WorkbenchTabSnapshot, "label" | "icon" | "menu"> };

export type WorkbenchPageMain = PageMain extends infer Main
  ? Main extends PageMain
    ? Omit<Main, "tab" | "empty"> & {
        readonly tab?: WorkbenchPlacementPresentation["tab"];
        readonly empty?: WorkbenchPagePlaceholder;
      }
    : never
  : never;

export interface WorkbenchPageContribution {
  id: string;
  ref: PageRef;
  title?: Localizable<string>;
  icon?: string;
  path: string;
  modeId: string;
  parentId?: string;
  resource?: ResourceConstraint;
  document?: PageDocumentDeclaration;
  params?: Readonly<Record<string, PageParamDefinition>>;
  regionSettings?: PageContribution["regionSettings"];
  main: WorkbenchPageMain;
  panelView?: PageContribution["panelView"];
  slots: readonly WorkbenchPageSlot[];
}

export interface WorkbenchPageResourceCodec {
  normalize(resource: ResourceRef): ResourceRef;
  toUri(resource: ResourceRef): string;
  fromUri(uri: string): ResourceRef | undefined;
}

export interface WorkbenchPagePlacementInput {
  pageContext?: ViewLocation["pageContext"];
  identity: PlacementIdentity;
  pageId: string;
  slotId: string;
  role: PageSlotRole;
  viewId: string;
  resource?: ResourceRef;
  section?: FileRendererSectionTarget;
  position?: FileSourcePosition;
  open?: PageOpenIntent;
  closable: boolean;
}

export interface WorkbenchPageOpenInput {
  pageContext?: ViewLocation["pageContext"];
  pageId: string;
  resource?: ResourceRef;
  section?: FileRendererSectionTarget;
  position?: FileSourcePosition;
  open?: PageOpenIntent;
}

export interface WorkbenchPageSlotOpenInput {
  pageId: string;
  slotId: string;
  resource?: ResourceRef;
  open?: PageOpenIntent;
  /** Explicit destination for this open. Omit to keep an existing tab's placement. */
  region?: DockedWorkbenchRegion;
}

export interface WorkbenchPageSlotInstance {
  pageContext?: ViewLocation["pageContext"];
  instanceKey: string;
  resource: ResourceRef;
  section?: FileRendererSectionTarget;
  position?: FileSourcePosition;
  open?: PageOpenIntent;
}

export interface WorkbenchPageRuntimeState {
  openStaticSlotIds: readonly string[];
  resourceInstances: Readonly<Record<string, readonly WorkbenchPageSlotInstance[]>>;
  activePrimaryInstanceKey?: string;
}

export interface WorkbenchPageRegistryStoreState<Value> {
  /** The runtime's committed result; consumers must not infer mode restoration from page caches. */
  layoutActivation?: "open-page" | "restore-mode";
  pages: Readonly<Record<string, WorkbenchPageContribution>>;
  pageStates: Readonly<Record<string, WorkbenchPageRuntimeState>>;
  projectId?: string;
  location?: PageLocation;
  activeModeId?: string;
  activePageId?: string;
  placements: readonly ResolvedOwnedPlacement<Value>[];
  reconciliation: OwnedPlacementReconciliation<Value>;
}

export interface CreateWorkbenchPageRegistryInput<Value> {
  validateMode?(modeId: string): void;
  restorePageState?(
    page: WorkbenchPageContribution,
    location: PageLocation,
    projectId: string,
  ): WorkbenchPageRuntimeState | undefined;
  resolveShellPlacements(context?: {
    modeId: string;
    pageId?: string;
    projectId?: string;
    location?: PageLocation;
  }): readonly ResolvedOwnedPlacement<Value>[];
  resolveModePlacements(
    modeId: string,
    location?: PageLocation,
    projectId?: string,
    pageId?: string,
  ): readonly ResolvedOwnedPlacement<Value>[];
  resolveLanding?(
    page: WorkbenchPageContribution,
    context: { projectId: string; location: PageLocation; open?: PageOpenIntent },
  ): { placements: readonly ResolvedOwnedPlacement<Value>[]; identity: PlacementIdentity } | undefined;
  validateLanding?(state: WorkbenchPageRegistryStoreState<Value>, identity: PlacementIdentity): void;
  resolvePagePlacement(input: WorkbenchPagePlacementInput): Value;
  resources: WorkbenchPageResourceCodec;
  valuesEqual(current: Value, desired: Value): boolean;
  registerPagePlacements?(page: WorkbenchPageContribution): { dispose(): void };
}

export interface WorkbenchPageRegistry<Value> {
  store: WorkbenchStore<WorkbenchPageRegistryStoreState<Value>>;
  /** Current page-owned Main content, outside the tab layout. */
  getContent(): Value | undefined;
  registerPage(page: WorkbenchPageContribution): { dispose(): void };
  getPage(pageId: string): WorkbenchPageContribution | undefined;
  listPages(): WorkbenchPageContribution[];
  resourceReferenceKey(resource: ResourceRef): string;
  refreshResource(resource: ResourceRef): void;
  refreshPlacement(identity: PlacementIdentity, reference: { resource: ResourceRef } & ViewLocation): void;
  pinPlacement(identity: PlacementIdentity, open?: PageOpenIntent): void;
  openSlot(input: WorkbenchPageSlotOpenInput): void;
}
