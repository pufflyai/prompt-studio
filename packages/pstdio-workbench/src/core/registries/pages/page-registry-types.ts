import type {
  FileRendererSectionTarget,
  Localizable,
  PageLocation,
  PageOpenIntent,
  PageRef,
  PageSlotCardinality,
  PageSlotRole,
  PlacementIdentity,
  PlacementRef,
  ResourceRef,
} from "@pstdio/sdk/extensions";
import type { WorkbenchStore } from "../../shared/store/workbench-store";
import type { DockedCompositionRegion } from "../layout/composition-resolver-types";
import type {
  WorkbenchPlacementOwnerState,
  WorkbenchPlacementState,
  WorkbenchPlacementStatePersistence,
} from "../layout/owned-placement-state";
import type { OwnedPlacementReconciliation, ResolvedOwnedPlacement } from "../layout/placement-reconciliation";

export interface WorkbenchPageSlotBinding {
  resourceKind: string;
  viewId: string;
}

export interface WorkbenchPageSlot {
  id: string;
  role: PageSlotRole;
  region: DockedCompositionRegion;
  viewId?: string;
  binding?: WorkbenchPageSlotBinding;
  cardinality?: PageSlotCardinality;
  closable?: boolean;
  defaultOpen?: boolean;
  defaultResource?: ResourceRef;
  order?: number;
}

export interface WorkbenchPageContribution {
  id: string;
  ref: PageRef;
  title: Localizable<string>;
  icon?: string;
  path: string;
  modeId: string;
  parentId?: string;
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
  placementState: WorkbenchPlacementState;
  placements: readonly ResolvedOwnedPlacement<Value>[];
  reconciliation: OwnedPlacementReconciliation<Value>;
}

export interface WorkbenchPageRegistryCommitInput<Value> {
  pageStates: Readonly<Record<string, WorkbenchPageRuntimeState>>;
  projectId?: string;
  location?: WorkbenchPageRegistryStoreState<Value>["location"];
  activePageId?: string;
  activeModeId?: string;
  modePlacements?: readonly ResolvedOwnedPlacement<Value>[];
  placementState?: WorkbenchPlacementState;
  activate?: readonly PlacementIdentity[];
  action: string;
}

export interface WorkbenchModePanelTargetInput<Value> {
  modeId: string;
  panel: PlacementRef;
  resource?: ResourceRef;
  open?: PageOpenIntent;
  current: readonly ResolvedOwnedPlacement<Value>[];
}

export interface WorkbenchModePanelTargetResolution<Value> {
  identity: PlacementIdentity;
  placements: readonly ResolvedOwnedPlacement<Value>[];
}

export interface CreateWorkbenchPageRegistryInput<Value> {
  resolveShellPlacements(): readonly ResolvedOwnedPlacement<Value>[];
  resolveModePlacements(
    modeId: string,
    current?: readonly ResolvedOwnedPlacement<Value>[],
    ownerState?: WorkbenchPlacementOwnerState,
  ): readonly ResolvedOwnedPlacement<Value>[];
  resolveModePanelTarget(input: WorkbenchModePanelTargetInput<Value>): WorkbenchModePanelTargetResolution<Value>;
  resolveModePlacementState?(
    modeId: string,
    placements: readonly ResolvedOwnedPlacement<Value>[],
  ): WorkbenchPlacementOwnerState;
  closeModePlacement?(input: {
    modeId: string;
    identity: PlacementIdentity;
    current: readonly ResolvedOwnedPlacement<Value>[];
  }): readonly ResolvedOwnedPlacement<Value>[];
  resolvePagePlacement(input: WorkbenchPagePlacementInput): Value;
  placementStatePersistence?: WorkbenchPlacementStatePersistence;
  resources: WorkbenchPageResourceCodec;
  valuesEqual(current: Value, desired: Value): boolean;
}

export interface WorkbenchPageRegistry<Value> {
  store: WorkbenchStore<WorkbenchPageRegistryStoreState<Value>>;
  registerPage(page: WorkbenchPageContribution): { dispose(): void };
  getPage(pageId: string): WorkbenchPageContribution | undefined;
  listPages(): WorkbenchPageContribution[];
}
