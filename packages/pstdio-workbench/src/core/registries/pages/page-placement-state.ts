import type { PlacementIdentity, ResourceRef } from "@pstdio/sdk/extensions";
import {
  emptyWorkbenchPlacementState,
  getWorkbenchPlacementOwnerState,
  type WorkbenchPlacementOwnerState,
  type WorkbenchPlacementState,
  type WorkbenchPlacementStatePersistence,
} from "../layout/owned-placement-state";
import { placementIdentityKey } from "../layout/placement-reconciliation";
import { pagePlacementIdentity } from "./page-placement-resolver";
import type { WorkbenchPageContribution, WorkbenchPageRuntimeState } from "./page-registry-types";
import { emptyPageState, openResourceSlot } from "./page-slot-lifecycle";

const isStaticAuxiliary = (slot: WorkbenchPageContribution["slots"][number]) =>
  slot.role === "auxiliary" && Boolean(slot.viewId);

const savedStaticState = (ownerState: WorkbenchPlacementOwnerState, identity: PlacementIdentity) =>
  ownerState.staticPlacements.find(
    (candidate) => placementIdentityKey(candidate.identity) === placementIdentityKey(identity),
  );

export const restoreWorkbenchPageState = (input: {
  page: WorkbenchPageContribution;
  ownerState?: WorkbenchPlacementOwnerState;
  resourceKey(resource: ResourceRef): string;
}) => {
  const initial = emptyPageState(input.page, input.resourceKey);
  const owner = input.ownerState;
  if (!owner || owner.owner.kind !== "page" || owner.owner.pageId !== input.page.id) return initial;

  const openStaticSlotIds = input.page.slots.flatMap((slot) => {
    if (!isStaticAuxiliary(slot)) return [];
    const identity = pagePlacementIdentity(input.page.id, slot.id, "default");
    const saved = savedStaticState(owner, identity);
    return (saved?.open ?? Boolean(slot.defaultOpen)) ? [slot.id] : [];
  });
  let state: WorkbenchPageRuntimeState = { ...initial, openStaticSlotIds };

  for (const pinned of owner.pinnedPlacements) {
    const identity = pinned.identity;
    if (identity.kind !== "page" || identity.pageId !== input.page.id) continue;
    const slot = input.page.slots.find((candidate) => candidate.id === identity.slotId);
    if (!slot?.binding || slot.cardinality !== "many") continue;
    if (pinned.resource.type !== slot.binding.resourceKind) continue;
    if (input.resourceKey(pinned.resource) !== identity.instanceKey) continue;
    state = openResourceSlot({
      slot,
      state,
      target: {
        pageId: input.page.id,
        resource: pinned.resource,
        open: "pin",
        ...(pinned.section ? { section: pinned.section } : {}),
      },
      resourceKey: input.resourceKey,
    });
  }

  return state;
};

export const snapshotWorkbenchPageState = (
  page: WorkbenchPageContribution,
  state: WorkbenchPageRuntimeState,
): WorkbenchPlacementOwnerState => {
  const staticPlacements = page.slots.flatMap((slot) =>
    isStaticAuxiliary(slot)
      ? [
          {
            identity: pagePlacementIdentity(page.id, slot.id, "default"),
            open: state.openStaticSlotIds.includes(slot.id),
          },
        ]
      : [],
  );
  const pinnedPlacements = page.slots.flatMap((slot) =>
    (state.resourceInstances[slot.id] ?? []).flatMap((instance) =>
      instance.open === "pin"
        ? [
            {
              identity: pagePlacementIdentity(page.id, slot.id, instance.instanceKey),
              resource: instance.resource,
              ...(instance.section ? { section: instance.section } : {}),
            },
          ]
        : [],
    ),
  );

  return {
    owner: { kind: "page", pageId: page.id },
    staticPlacements,
    pinnedPlacements,
  };
};

export const loadWorkbenchPlacementState = (
  persistence: WorkbenchPlacementStatePersistence | undefined,
  projectId: string,
) => persistence?.load(projectId) ?? emptyWorkbenchPlacementState();

export const restoreWorkbenchPageStates = (
  pages: Readonly<Record<string, WorkbenchPageContribution>>,
  placementState: WorkbenchPlacementState,
  resourceKey: (resource: ResourceRef) => string,
) =>
  Object.fromEntries(
    Object.values(pages).map((page) => [
      page.id,
      restoreWorkbenchPageState({
        page,
        ownerState: getWorkbenchPlacementOwnerState(placementState, { kind: "page", pageId: page.id }),
        resourceKey,
      }),
    ]),
  );
