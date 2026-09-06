import type {
  FileRendererSectionTarget,
  Localizable,
  PageLocation,
  PageMain,
  PageOpenIntent,
  PageRef,
  PageSlot,
  PageSlotRole,
  PlacementIdentity,
  ResourceConstraint,
  ResourceRef,
} from "@pstdio/sdk/extensions";
import type { WorkbenchStore } from "../../shared/store/workbench-store";
import type { OwnedPlacementReconciliation, ResolvedOwnedPlacement } from "../layout/placement-reconciliation";
import type { WorkbenchPlacementPresentation } from "../views/view-placement";

export interface WorkbenchPageSlot extends Omit<PageSlot, "tab"> {
  readonly tab?: WorkbenchPlacementPresentation["tab"];
}

export type WorkbenchPageMain = PageMain extends infer Main
  ? Main extends PageMain
    ? Omit<Main, "tab"> & { readonly tab?: WorkbenchPlacementPresentation["tab"] }
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
  main: WorkbenchPageMain;
  slots: readonly WorkbenchPageSlot[];
}

export interface WorkbenchPageResourceCodec {
  normalize(resource: ResourceRef): ResourceRef;
  toUri(resource: ResourceRef): string;
  fromUri(uri: string): ResourceRef | undefined;
}

export interface WorkbenchPagePlacementInput {
  identity: PlacementIdentity;
  pageId: string;
  slotId: string;
  role: PageSlotRole;
  viewId: string;
  resource?: ResourceRef;
  section?: FileRendererSectionTarget;
  open?: PageOpenIntent;
  closable: boolean;
}

export interface WorkbenchPageOpenInput {
  pageId: string;
  resource?: ResourceRef;
  section?: FileRendererSectionTarget;
  open?: PageOpenIntent;
}

export interface WorkbenchPageSlotOpenInput {
  pageId: string;
  slotId: string;
  resource?: ResourceRef;
  open?: PageOpenIntent;
}

export interface WorkbenchPageSlotInstance {
  instanceKey: string;
  resource: ResourceRef;
  section?: FileRendererSectionTarget;
  open?: PageOpenIntent;
}

export interface WorkbenchPageRuntimeState {
  openStaticSlotIds: readonly string[];
  resourceInstances: Readonly<Record<string, readonly WorkbenchPageSlotInstance[]>>;
  activePrimaryInstanceKey?: string;
}

export interface WorkbenchPageRegistryStoreState<Value> {
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
  resolvePagePlacement(input: WorkbenchPagePlacementInput): Value;
  resources: WorkbenchPageResourceCodec;
  valuesEqual(current: Value, desired: Value): boolean;
  registerPagePlacements?(page: WorkbenchPageContribution): { dispose(): void };
}

export interface WorkbenchPageRegistry<Value> {
  store: WorkbenchStore<WorkbenchPageRegistryStoreState<Value>>;
  registerPage(page: WorkbenchPageContribution): { dispose(): void };
  getPage(pageId: string): WorkbenchPageContribution | undefined;
  listPages(): WorkbenchPageContribution[];
  pinPlacement(identity: PlacementIdentity): void;
  openSlot(input: WorkbenchPageSlotOpenInput): void;
}
