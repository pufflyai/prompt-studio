import type { NavigationTargetPanel, PageLocation, PlacementIdentity } from "@pstdio/sdk/extensions";
import type { ResolvedOwnedPlacement } from "../layout/placement-reconciliation";
import { resolveWorkbenchPageState } from "./page-registry-state";
import type {
  CreateWorkbenchPageRegistryInput,
  WorkbenchPageContribution,
  WorkbenchPageOpenInput,
  WorkbenchPageRegistryCommitInput,
  WorkbenchPageRegistryStoreState,
  WorkbenchPageResourceCodec,
  WorkbenchPageRuntimeState,
} from "./page-registry-types";
import { resolveWorkbenchPanelTarget, type WorkbenchPanelTargetResolution } from "./panel-target-opening";

interface ResolveWorkbenchPanelTargetBatchInput<Value> {
  targets: readonly NavigationTargetPanel[];
  registryInput: CreateWorkbenchPageRegistryInput<Value>;
  state: WorkbenchPageRegistryStoreState<Value>;
  normalizeResource: WorkbenchPageResourceCodec["normalize"];
  resourceKey(resource: Parameters<WorkbenchPageResourceCodec["toUri"]>[0]): string;
}

const replaceModePlacements = <Value>(
  state: WorkbenchPageRegistryStoreState<Value>,
  modePlacements: readonly ResolvedOwnedPlacement<Value>[],
) => ({
  ...state,
  placements: [...state.placements.filter((placement) => placement.identity.kind !== "mode"), ...modePlacements],
});

export const resolveWorkbenchPanelTargetBatch = <Value>(input: ResolveWorkbenchPanelTargetBatchInput<Value>) => {
  let state = input.state;
  let modePlacements = state.placements.filter(
    (placement) => placement.identity.kind === "mode" && placement.identity.modeId === state.activeModeId,
  );
  const identities: PlacementIdentity[] = [];

  for (const target of input.targets) {
    const resolution: WorkbenchPanelTargetResolution<Value> = resolveWorkbenchPanelTarget({
      target,
      registryInput: input.registryInput,
      state,
      normalizeResource: input.normalizeResource,
      resourceKey: input.resourceKey,
    });
    identities.push(resolution.identity);
    if (resolution.modePlacements) modePlacements = [...resolution.modePlacements];
    state = replaceModePlacements({ ...state, pageStates: resolution.pageStates }, modePlacements);
  }

  return { pageStates: state.pageStates, modePlacements, identities };
};

export const openWorkbenchPanelTargetBatch = <Value>(
  input: ResolveWorkbenchPanelTargetBatchInput<Value> & {
    commit(next: WorkbenchPageRegistryCommitInput<Value>): void;
  },
) => {
  const resolution = resolveWorkbenchPanelTargetBatch(input);
  input.commit({
    pageStates: resolution.pageStates,
    projectId: input.state.projectId,
    location: input.state.location,
    activePageId: input.state.activePageId,
    activeModeId: input.state.activeModeId,
    modePlacements: resolution.modePlacements,
    activate: resolution.identities,
    action: "openPanelTargetBatch",
  });
  return resolution.identities;
};

const resolveWorkbenchPageTargetBatch = <Value>(input: {
  pageResolution: WorkbenchPageRegistryCommitInput<Value>;
  panels: readonly NavigationTargetPanel[];
  registryInput: CreateWorkbenchPageRegistryInput<Value>;
  current: WorkbenchPageRegistryStoreState<Value>;
  modePlacements: readonly ResolvedOwnedPlacement<Value>[];
  normalizeResource: WorkbenchPageResourceCodec["normalize"];
  resourceKey(resource: Parameters<WorkbenchPageResourceCodec["toUri"]>[0]): string;
}) => {
  const projected = replaceModePlacements(
    {
      ...input.current,
      pageStates: input.pageResolution.pageStates,
      projectId: input.pageResolution.projectId,
      location: input.pageResolution.location,
      activePageId: input.pageResolution.activePageId,
      activeModeId: input.pageResolution.activeModeId,
      placementState: input.pageResolution.placementState ?? input.current.placementState,
    },
    input.modePlacements,
  );
  const panels = resolveWorkbenchPanelTargetBatch({
    targets: input.panels,
    registryInput: input.registryInput,
    state: projected,
    normalizeResource: input.normalizeResource,
    resourceKey: input.resourceKey,
  });
  return {
    ...input.pageResolution,
    pageStates: panels.pageStates,
    modePlacements: panels.modePlacements,
    activate: [...(input.pageResolution.activate ?? []), ...panels.identities],
  } satisfies WorkbenchPageRegistryCommitInput<Value>;
};

interface WorkbenchPageLocationTarget extends WorkbenchPageOpenInput {
  projectId: string;
  location: PageLocation;
  action: string;
  panels?: readonly NavigationTargetPanel[];
  pageStates?: Readonly<Record<string, WorkbenchPageRuntimeState>>;
}

export const resolveWorkbenchPageLocationTarget = <Value>(input: {
  target: WorkbenchPageLocationTarget;
  page: WorkbenchPageContribution;
  current: WorkbenchPageRegistryStoreState<Value>;
  registryInput: CreateWorkbenchPageRegistryInput<Value>;
  resolveModePlacements(
    placementState: WorkbenchPageRegistryStoreState<Value>["placementState"],
  ): readonly ResolvedOwnedPlacement<Value>[] | undefined;
  normalizeResource: WorkbenchPageResourceCodec["normalize"];
  resourceKey(resource: Parameters<WorkbenchPageResourceCodec["toUri"]>[0]): string;
}) => {
  const pageResolution = resolveWorkbenchPageState({
    target: input.target,
    page: input.page,
    current: input.current,
    pageStates: input.target.pageStates ?? input.current.pageStates,
    locationState: { projectId: input.target.projectId, location: input.target.location },
    persistence: input.registryInput.placementStatePersistence,
    normalizeResource: input.normalizeResource,
    resourceKey: input.resourceKey,
    action: input.target.action,
  });
  if (!input.target.panels?.length) return pageResolution;
  return resolveWorkbenchPageTargetBatch({
    pageResolution,
    panels: input.target.panels,
    registryInput: input.registryInput,
    current: input.current,
    modePlacements: input.resolveModePlacements(pageResolution.placementState ?? input.current.placementState) ?? [],
    normalizeResource: input.normalizeResource,
    resourceKey: input.resourceKey,
  });
};
