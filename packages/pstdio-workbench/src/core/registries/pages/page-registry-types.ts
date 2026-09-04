import type {
  DockedWorkbenchRegion,
  FileRendererSectionTarget,
  Localizable,
  PageLocation,
  PageOpenIntent,
  PageRef,
  PageSlotCardinality,
  PageSlotRole,
  PlacementIdentity,
  ResourceRef,
} from "@pstdio/sdk/extensions";
import type { WorkbenchStore } from "../../shared/store/workbench-store";
import type { OwnedPlacementReconciliation, ResolvedOwnedPlacement } from "../layout/placement-reconciliation";
import type { NavigationTarget } from "../navigation/navigation-registry";
import type { WorkbenchPlacementPresence } from "../placements/owned-placement-lifecycle";
import type { WorkbenchPlacementPresentation } from "../views/view-placement";

export interface WorkbenchPageSlotBinding {
  resourceKinds: readonly string[];
  viewId: string;
  cardinality: PageSlotCardinality;
  add?: NavigationTarget;
}

interface WorkbenchPageSlotBase extends WorkbenchPlacementPresentation {
  id: string;
  region: DockedWorkbenchRegion;
  order?: number;
}

export interface WorkbenchPagePrimarySlot extends WorkbenchPageSlotBase {
  role: "primary";
  viewId?: string;
  binding?: WorkbenchPageSlotBinding;
}

export interface WorkbenchPageStaticSlot extends WorkbenchPageSlotBase {
  role: "auxiliary";
  viewId: string;
  presence: WorkbenchPlacementPresence;
  binding?: undefined;
}

export interface WorkbenchPageBoundSlot extends WorkbenchPageSlotBase {
  role: "auxiliary";
  binding: WorkbenchPageSlotBinding;
  viewId?: undefined;
  openOn?: "page-resource";
}

export type WorkbenchPageSlot = WorkbenchPagePrimarySlot | WorkbenchPageStaticSlot | WorkbenchPageBoundSlot;

export interface WorkbenchPageContribution {
  id: string;
  ref: PageRef;
  title?: Localizable<string>;
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
  resolveShellPlacements(): readonly ResolvedOwnedPlacement<Value>[];
  resolveModePlacements(modeId: string): readonly ResolvedOwnedPlacement<Value>[];
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
  openSlot(input: WorkbenchPageSlotOpenInput): void;
}
