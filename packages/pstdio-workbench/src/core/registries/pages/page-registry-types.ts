import type {
  FileRendererSectionTarget,
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
  placements: readonly ResolvedOwnedPlacement<Value>[];
  reconciliation: OwnedPlacementReconciliation<Value>;
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
  resolveModePlacements(modeId: string): readonly ResolvedOwnedPlacement<Value>[];
  resolveModePanelTarget(input: WorkbenchModePanelTargetInput<Value>): WorkbenchModePanelTargetResolution<Value>;
  resolvePagePlacement(input: WorkbenchPagePlacementInput): Value;
  resources: WorkbenchPageResourceCodec;
  valuesEqual(current: Value, desired: Value): boolean;
}

export interface WorkbenchPageRegistry<Value> {
  store: WorkbenchStore<WorkbenchPageRegistryStoreState<Value>>;
  registerPage(page: WorkbenchPageContribution): { dispose(): void };
  getPage(pageId: string): WorkbenchPageContribution | undefined;
  listPages(): WorkbenchPageContribution[];
}
