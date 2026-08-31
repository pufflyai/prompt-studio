import type { FileRendererSectionTarget, PlacementIdentity, ResourceRef } from "@pstdio/sdk/extensions";

export type WorkbenchPlacementOwner =
  | { readonly kind: "mode"; readonly modeId: string }
  | { readonly kind: "page"; readonly pageId: string };

export interface WorkbenchStaticPlacementState {
  readonly identity: PlacementIdentity;
  readonly open: boolean;
}

export interface WorkbenchPinnedPlacementState {
  readonly identity: PlacementIdentity;
  readonly resource: ResourceRef;
  readonly section?: FileRendererSectionTarget;
}

export interface WorkbenchPlacementOwnerState {
  readonly owner: WorkbenchPlacementOwner;
  readonly staticPlacements: readonly WorkbenchStaticPlacementState[];
  readonly pinnedPlacements: readonly WorkbenchPinnedPlacementState[];
}

export interface WorkbenchPlacementState {
  readonly owners: readonly WorkbenchPlacementOwnerState[];
}

export interface WorkbenchPlacementStatePersistence {
  load(projectId: string): WorkbenchPlacementState | undefined;
  save(projectId: string, state: WorkbenchPlacementState): void;
}

export const emptyWorkbenchPlacementState = (): WorkbenchPlacementState => ({ owners: [] });

export const placementOwnerKey = (owner: WorkbenchPlacementOwner) =>
  owner.kind === "mode" ? `mode\0${owner.modeId}` : `page\0${owner.pageId}`;

export const getWorkbenchPlacementOwnerState = (state: WorkbenchPlacementState, owner: WorkbenchPlacementOwner) =>
  state.owners.find((candidate) => placementOwnerKey(candidate.owner) === placementOwnerKey(owner));

export const replaceWorkbenchPlacementOwnerState = (
  state: WorkbenchPlacementState,
  ownerState: WorkbenchPlacementOwnerState,
): WorkbenchPlacementState => {
  const key = placementOwnerKey(ownerState.owner);
  const owners = state.owners.filter((candidate) => placementOwnerKey(candidate.owner) !== key);
  return {
    owners: [...owners, ownerState].sort((left, right) =>
      placementOwnerKey(left.owner).localeCompare(placementOwnerKey(right.owner)),
    ),
  };
};
