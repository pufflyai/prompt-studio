import type { PlacementIdentity, ResourceRef } from "@pstdio/sdk/extensions";
import { resolvePagePlacementClose } from "./page-placement-close";
import type {
  CreateWorkbenchPageRegistryInput,
  WorkbenchPageContribution,
  WorkbenchPageRegistryStoreState,
  WorkbenchPageRuntimeState,
} from "./page-registry-types";

interface PagePanelCloseCommit<Value> {
  pageStates: Readonly<Record<string, WorkbenchPageRuntimeState>>;
  projectId?: string;
  location?: WorkbenchPageRegistryStoreState<Value>["location"];
  activePageId?: string;
  activeModeId?: string;
  modePlacements?: WorkbenchPageRegistryStoreState<Value>["placements"];
  action: string;
}

export const closeWorkbenchPanelPlacement = <Value>(input: {
  identity: PlacementIdentity;
  registryInput: CreateWorkbenchPageRegistryInput<Value>;
  state: WorkbenchPageRegistryStoreState<Value>;
  requirePage(pageId: string): WorkbenchPageContribution;
  resourceKey(resource: ResourceRef): string;
  commit(change: PagePanelCloseCommit<Value>): void;
}) => {
  const { identity, state } = input;
  if (identity.kind === "mode") {
    const modeId = state.activeModeId;
    if (!modeId || identity.modeId !== modeId) {
      throw new Error(`Mode placement owner is not active: ${identity.modeId}`);
    }
    if (!input.registryInput.closeModePlacement) throw new Error("Mode placement close is unavailable");
    const placements = input.registryInput.closeModePlacement({
      modeId,
      identity,
      current: state.placements.filter(
        (placement) => placement.identity.kind === "mode" && placement.identity.modeId === modeId,
      ),
    });
    input.commit({
      pageStates: state.pageStates,
      projectId: state.projectId,
      location: state.location,
      activePageId: state.activePageId,
      activeModeId: modeId,
      modePlacements: placements,
      action: "closeModePanelPlacement",
    });
    return;
  }
  if (identity.kind !== "page" || identity.pageId !== state.activePageId) {
    throw new Error("Panel placement owner is not the active page or mode");
  }
  const resolution = resolvePagePlacementClose({
    identity,
    page: input.requirePage(identity.pageId),
    state,
    resourceKey: input.resourceKey,
  });
  if (resolution.kind === "parent" || resolution.locationChanged) {
    throw new Error("Active primary placement close requires the page location controller");
  }
  input.commit({
    pageStates: resolution.pageStates,
    projectId: state.projectId,
    location: state.location,
    activePageId: state.activePageId,
    activeModeId: state.activeModeId,
    action: "closePagePanelPlacement",
  });
};
