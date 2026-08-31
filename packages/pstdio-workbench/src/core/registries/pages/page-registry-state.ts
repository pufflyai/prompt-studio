import { replaceWorkbenchPlacementOwnerState, type WorkbenchPlacementState } from "../layout/owned-placement-state";
import type { ResolvedOwnedPlacement } from "../layout/placement-reconciliation";
import { pagePlacementIdentity } from "./page-placement-resolver";
import {
  loadWorkbenchPlacementState,
  restoreWorkbenchPageStates,
  snapshotWorkbenchPageState,
} from "./page-placement-state";
import type {
  CreateWorkbenchPageRegistryInput,
  WorkbenchPageContribution,
  WorkbenchPageOpenInput,
  WorkbenchPageRegistryCommitInput,
  WorkbenchPageRegistryStoreState,
  WorkbenchPageResourceCodec,
  WorkbenchPageRuntimeState,
} from "./page-registry-types";
import { emptyPageState, primarySlot, selectPrimaryTarget } from "./page-slot-lifecycle";

export const snapshotOwnerPlacementStates = <Value>(input: {
  state: WorkbenchPlacementState;
  page?: WorkbenchPageContribution;
  pageState?: WorkbenchPageRuntimeState;
  modeId?: string;
  modePlacements?: readonly ResolvedOwnedPlacement<Value>[];
  resolveModePlacementState?: CreateWorkbenchPageRegistryInput<Value>["resolveModePlacementState"];
}) => {
  let state = input.state;
  if (input.page && input.pageState) {
    state = replaceWorkbenchPlacementOwnerState(state, snapshotWorkbenchPageState(input.page, input.pageState));
  }
  if (input.modeId && input.modePlacements && input.resolveModePlacementState) {
    state = replaceWorkbenchPlacementOwnerState(
      state,
      input.resolveModePlacementState(input.modeId, input.modePlacements),
    );
  }
  return state;
};

export const activateWorkbenchPageState = <Value>(input: {
  target: WorkbenchPageOpenInput;
  page: WorkbenchPageContribution;
  current: WorkbenchPageRegistryStoreState<Value>;
  pageStates: Readonly<Record<string, WorkbenchPageRuntimeState>>;
  locationState: Pick<WorkbenchPageRegistryStoreState<Value>, "projectId" | "location">;
  persistence: CreateWorkbenchPageRegistryInput<Value>["placementStatePersistence"];
  normalizeResource: WorkbenchPageResourceCodec["normalize"];
  resourceKey(resource: Parameters<WorkbenchPageResourceCodec["toUri"]>[0]): string;
  commit(next: WorkbenchPageRegistryCommitInput<Value>): void;
  action: string;
}) => {
  const projectId = input.locationState.projectId;
  const projectChanged = projectId !== undefined && projectId !== input.current.projectId;
  const placementState = projectChanged
    ? loadWorkbenchPlacementState(input.persistence, projectId)
    : input.current.placementState;
  const availablePageStates = projectChanged
    ? restoreWorkbenchPageStates(input.current.pages, placementState, input.resourceKey)
    : input.pageStates;
  const target = {
    ...input.target,
    ...(input.target.resource ? { resource: input.normalizeResource(input.target.resource) } : {}),
  };
  const currentPageState = availablePageStates[input.page.id] ?? emptyPageState(input.page, input.resourceKey);
  const pageState = selectPrimaryTarget({
    page: input.page,
    state: currentPageState,
    target,
    resourceKey: input.resourceKey,
  });
  const instanceKey = pageState.activePrimaryInstanceKey;
  if (!instanceKey) throw new Error(`Page "${input.page.id}" did not resolve a primary instance`);
  input.commit({
    pageStates: { ...availablePageStates, [input.page.id]: pageState },
    projectId,
    location: input.locationState.location,
    activePageId: input.page.id,
    activeModeId: input.page.modeId,
    placementState,
    activate: [pagePlacementIdentity(input.page.id, primarySlot(input.page).id, instanceKey)],
    action: input.action,
  });
};
