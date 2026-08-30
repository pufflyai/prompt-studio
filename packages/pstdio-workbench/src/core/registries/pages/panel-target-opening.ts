import type { NavigationTargetPanel, PlacementIdentity, ResourceRef } from "@pstdio/sdk/extensions";
import { placementIdentityKey, type ResolvedOwnedPlacement } from "../layout/placement-reconciliation";
import { pagePlacementIdentity } from "./page-placement-resolver";
import type {
  CreateWorkbenchPageRegistryInput,
  WorkbenchPageContribution,
  WorkbenchPageRegistryStoreState,
  WorkbenchPageRuntimeState,
  WorkbenchPageSlot,
} from "./page-registry-types";
import { emptyPageState, openResourceSlot, requirePageSlot, setStaticSlotOpen } from "./page-slot-lifecycle";

interface PanelTargetCommitInput<Value> {
  pageStates: Readonly<Record<string, WorkbenchPageRuntimeState>>;
  modePlacements?: readonly ResolvedOwnedPlacement<Value>[];
  identity: PlacementIdentity;
  action: string;
}

interface OpenWorkbenchPanelTargetInput<Value> {
  target: NavigationTargetPanel;
  registryInput: CreateWorkbenchPageRegistryInput<Value>;
  state: WorkbenchPageRegistryStoreState<Value>;
  normalizeResource(resource: ResourceRef): ResourceRef;
  resourceKey(resource: ResourceRef): string;
  commit(input: PanelTargetCommitInput<Value>): void;
}

const requireActivePagePanel = <Value>(input: OpenWorkbenchPanelTargetInput<Value>) => {
  const panel = input.target.panel;
  if (panel.kind !== "page-slot") throw new Error("Panel target does not reference a page slot");
  const page = Object.values(input.state.pages).find(
    (candidate) => candidate.ref.extensionId === panel.page.extensionId && candidate.ref.id === panel.page.id,
  );
  if (!page) throw new Error(`Unknown page panel owner: ${panel.page.extensionId}.${panel.page.id}`);
  if (input.state.activePageId !== page.id) throw new Error(`Page panel owner is not active: ${page.id}`);
  const slot = requirePageSlot(page, panel.id);
  if (slot.role !== "auxiliary") throw new Error(`Page slot is not an auxiliary panel: ${page.id}.${slot.id}`);
  return { page, slot };
};

const openPagePanelState = <Value>(
  input: OpenWorkbenchPanelTargetInput<Value>,
  page: WorkbenchPageContribution,
  slot: WorkbenchPageSlot,
) => {
  const current = input.state.pageStates[page.id] ?? emptyPageState(page, input.resourceKey);
  const resource = input.target.resource ? input.normalizeResource(input.target.resource) : slot.defaultResource;
  if (resource) {
    const instanceKey = input.resourceKey(resource);
    const state = openResourceSlot({
      slot,
      state: current,
      target: {
        pageId: page.id,
        resource,
        ...(input.target.open ? { open: input.target.open } : {}),
      },
      resourceKey: () => instanceKey,
    });
    return { state, instanceKey };
  }
  if (slot.binding) throw new Error(`Page slot "${slot.id}" requires a resource`);
  if (input.target.open) throw new Error(`Page slot "${slot.id}" accepts open intent only with a resource`);
  return { state: setStaticSlotOpen(current, slot.id, true), instanceKey: "default" };
};

const openPagePanel = <Value>(input: OpenWorkbenchPanelTargetInput<Value>) => {
  const { page, slot } = requireActivePagePanel(input);
  const { state, instanceKey } = openPagePanelState(input, page, slot);
  const identity = pagePlacementIdentity(page.id, slot.id, instanceKey);
  input.commit({
    pageStates: { ...input.state.pageStates, [page.id]: state },
    identity,
    action: "openPagePanelTarget",
  });
  return identity;
};

const assertModePanelResolution = <Value>(
  modeId: string,
  identity: PlacementIdentity,
  placements: readonly ResolvedOwnedPlacement<Value>[],
) => {
  if (placements.some((placement) => placement.identity.kind !== "mode" || placement.identity.modeId !== modeId)) {
    throw new Error(`Mode panel placement owner does not match active mode: ${modeId}`);
  }
  if (identity.kind !== "mode" || identity.modeId !== modeId) {
    throw new Error(`Mode panel activation owner does not match active mode: ${modeId}`);
  }
  const identityKey = placementIdentityKey(identity);
  if (!placements.some((placement) => placementIdentityKey(placement.identity) === identityKey)) {
    throw new Error(`Mode panel activation is missing from resolved placements: ${identityKey}`);
  }
};

const openModePanel = <Value>(input: OpenWorkbenchPanelTargetInput<Value>) => {
  const panel = input.target.panel;
  if (panel.kind !== "placement") throw new Error("Panel target does not reference a mode placement");
  const modeId = input.state.activeModeId;
  if (!modeId) throw new Error("No mode is active");
  const current = input.state.placements.filter(
    (placement) => placement.identity.kind === "mode" && placement.identity.modeId === modeId,
  );
  const resolution = input.registryInput.resolveModePanelTarget({
    modeId,
    panel,
    current,
    ...(input.target.resource ? { resource: input.normalizeResource(input.target.resource) } : {}),
    ...(input.target.open ? { open: input.target.open } : {}),
  });
  assertModePanelResolution(modeId, resolution.identity, resolution.placements);
  input.commit({
    pageStates: input.state.pageStates,
    modePlacements: resolution.placements,
    identity: resolution.identity,
    action: "openModePanelTarget",
  });
  return resolution.identity;
};

export const openWorkbenchPanelTarget = <Value>(input: OpenWorkbenchPanelTargetInput<Value>) =>
  input.target.panel.kind === "page-slot" ? openPagePanel(input) : openModePanel(input);
