import type { PlacementIdentity } from "@pstdio/sdk/extensions";
import { createWorkbenchStore } from "../../shared/store/workbench-store";
import {
  composeOwnedPlacements,
  type OwnedPlacementReconciliation,
  type ResolvedOwnedPlacement,
} from "../layout/placement-reconciliation";
import type {
  CreateWorkbenchPageRegistryInput,
  WorkbenchPageRegistryStoreState,
  WorkbenchPageRuntimeState,
} from "./page-registry-types";

const emptyReconciliation = <Value>(): OwnedPlacementReconciliation<Value> => ({
  add: [],
  retain: [],
  update: [],
  activate: [],
  remove: [],
});

export interface PageRegistryCommitInput<Value> {
  pageStates: Readonly<Record<string, WorkbenchPageRuntimeState>>;
  projectId?: string;
  location?: WorkbenchPageRegistryStoreState<Value>["location"];
  activePageId?: string;
  activeModeId?: string;
  modePlacements?: readonly ResolvedOwnedPlacement<Value>[];
  activate?: readonly PlacementIdentity[];
  action: string;
}

export const createPageRegistryStore = <Value>(input: CreateWorkbenchPageRegistryInput<Value>) =>
  createWorkbenchStore<WorkbenchPageRegistryStoreState<Value>>({
    name: "workbench.pages",
    initialState: {
      pages: {},
      pageStates: {},
      placements: composeOwnedPlacements({ shell: input.resolveShellPlacements() }).placements,
      reconciliation: emptyReconciliation(),
    },
  });

export const resolveModePlacementSet = <Value>(input: {
  current: WorkbenchPageRegistryStoreState<Value>;
  modeId: string | undefined;
  desired: readonly ResolvedOwnedPlacement<Value>[] | undefined;
  location?: WorkbenchPageRegistryStoreState<Value>["location"];
  projectId?: string;
  pageId?: string;
  resolveModePlacements: CreateWorkbenchPageRegistryInput<Value>["resolveModePlacements"];
}) => {
  if (!input.modeId) return undefined;
  if (input.desired) return input.desired;
  if (input.modeId !== input.current.activeModeId || input.projectId !== input.current.projectId)
    return input.resolveModePlacements(input.modeId, input.location, input.projectId, input.pageId);
  return input.current.placements.filter(
    (placement) => placement.identity.kind === "mode" && placement.identity.modeId === input.modeId,
  );
};

export const refreshActiveModePlacements = <Value>(input: {
  state: WorkbenchPageRegistryStoreState<Value>;
  registryInput: CreateWorkbenchPageRegistryInput<Value>;
  commit(next: PageRegistryCommitInput<Value>): void;
}) => {
  const modeId = input.state.activeModeId;
  if (!modeId) return;
  input.commit({
    pageStates: input.state.pageStates,
    projectId: input.state.projectId,
    location: input.state.location,
    activePageId: input.state.activePageId,
    activeModeId: modeId,
    modePlacements: input.registryInput.resolveModePlacements(modeId),
    action: "refreshModePlacements",
  });
};

export const refreshShellPlacements = <Value>(input: {
  state: WorkbenchPageRegistryStoreState<Value>;
  commit(next: PageRegistryCommitInput<Value>): void;
}) => {
  input.commit({
    pageStates: input.state.pageStates,
    projectId: input.state.projectId,
    location: input.state.location,
    activePageId: input.state.activePageId,
    activeModeId: input.state.activeModeId,
    action: "refreshShellPlacements",
  });
};
