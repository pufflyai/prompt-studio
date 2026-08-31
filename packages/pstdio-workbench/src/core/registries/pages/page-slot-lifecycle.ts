import type { PageOpenIntent, ResourceRef } from "@pstdio/sdk/extensions";
import type {
  WorkbenchPageContribution,
  WorkbenchPageOpenInput,
  WorkbenchPageRuntimeState,
  WorkbenchPageSlot,
  WorkbenchPageSlotInstance,
} from "./page-registry-types";

export const emptyPageState = (
  page: WorkbenchPageContribution,
  resourceKey: (resource: ResourceRef) => string,
): WorkbenchPageRuntimeState => ({
  openStaticSlotIds: page.slots
    .filter((slot) => slot.role === "auxiliary" && Boolean(slot.viewId) && slot.defaultOpen)
    .map((slot) => slot.id),
  resourceInstances: Object.fromEntries(
    page.slots.flatMap((slot) => {
      if (slot.role !== "auxiliary" || !slot.defaultOpen || !slot.defaultResource) return [];
      const instanceKey = resourceKey(slot.defaultResource);
      const instance: WorkbenchPageSlotInstance = {
        instanceKey,
        resource: slot.defaultResource,
        ...(slot.cardinality === "many" ? { open: "preview" as const } : {}),
      };
      return [[slot.id, [instance]] as const];
    }),
  ),
  activePrimaryInstanceKey: undefined,
});

export const requirePageSlot = (page: WorkbenchPageContribution, slotId: string) => {
  const slot = page.slots.find((candidate) => candidate.id === slotId);
  if (!slot) throw new Error(`Unknown page slot: ${page.id}.${slotId}`);
  return slot;
};

export const primarySlot = (page: WorkbenchPageContribution) => {
  const slot = page.slots.find((candidate) => candidate.role === "primary");
  if (!slot) throw new Error(`Page has no primary slot: ${page.id}`);
  return slot;
};

const assertOpenIntent = (slot: WorkbenchPageSlot, open: PageOpenIntent | undefined) => {
  if (open && slot.cardinality !== "many") {
    throw new Error(`Page slot "${slot.id}" accepts open intent only with many cardinality`);
  }
};

const requireMatchingResource = (slot: WorkbenchPageSlot, resource: ResourceRef | undefined) => {
  if (!slot.binding) {
    if (resource) throw new Error(`Page slot "${slot.id}" does not accept a resource`);
    return undefined;
  }
  if (!resource) throw new Error(`Page slot "${slot.id}" requires a resource`);
  if (resource.type !== slot.binding.resourceKind) {
    throw new Error(`Page slot "${slot.id}" does not accept resource kind "${resource.type}"`);
  }
  return resource;
};

const nextResourceInstances = (
  slot: WorkbenchPageSlot,
  current: readonly WorkbenchPageSlotInstance[],
  instance: WorkbenchPageSlotInstance,
): WorkbenchPageSlotInstance[] => {
  if (slot.cardinality !== "many") return [instance];
  const existing = current.find((candidate) => candidate.instanceKey === instance.instanceKey);
  const open: PageOpenIntent = existing?.open === "pin" || instance.open === "pin" ? "pin" : "preview";
  const retained = current.filter(
    (candidate) => candidate.instanceKey !== instance.instanceKey && (open === "pin" || candidate.open === "pin"),
  );
  return [...retained, { ...instance, open }];
};

export const openResourceSlot = (input: {
  slot: WorkbenchPageSlot;
  state: WorkbenchPageRuntimeState;
  target: WorkbenchPageOpenInput;
  resourceKey(resource: ResourceRef): string;
}) => {
  const { slot, state, target } = input;
  assertOpenIntent(slot, target.open);
  const resource = requireMatchingResource(slot, target.resource);
  if (!resource || !slot.binding) throw new Error(`Page slot "${slot.id}" requires a resource`);
  const instanceKey = input.resourceKey(resource);
  if (!instanceKey) throw new Error(`Page slot "${slot.id}" resolved an empty resource identity`);
  const instance: WorkbenchPageSlotInstance = {
    instanceKey,
    resource,
    ...(target.section ? { section: target.section } : {}),
    ...(slot.cardinality === "many" ? { open: target.open ?? "preview" } : {}),
  };
  const resourceInstances = {
    ...state.resourceInstances,
    [slot.id]: nextResourceInstances(slot, state.resourceInstances[slot.id] ?? [], instance),
  };
  return {
    ...state,
    resourceInstances,
    ...(slot.role === "primary" ? { activePrimaryInstanceKey: instanceKey } : {}),
  } satisfies WorkbenchPageRuntimeState;
};

export const selectPrimaryTarget = (input: {
  page: WorkbenchPageContribution;
  state: WorkbenchPageRuntimeState;
  target: WorkbenchPageOpenInput;
  resourceKey(resource: ResourceRef): string;
}) => {
  const slot = primarySlot(input.page);
  assertOpenIntent(slot, input.target.open);
  if (input.target.resource) {
    if (!slot.binding) throw new Error(`Page slot "${slot.id}" does not accept a resource`);
    return openResourceSlot({ ...input, slot });
  }
  if (slot.binding && !slot.viewId) throw new Error(`Page slot "${slot.id}" requires a resource`);
  if (input.target.open) throw new Error(`Page slot "${slot.id}" accepts open intent only with a resource`);
  return { ...input.state, activePrimaryInstanceKey: "default" };
};

export const openDefaultAuxiliaryBindings = (input: {
  page: WorkbenchPageContribution;
  state: WorkbenchPageRuntimeState;
  target: WorkbenchPageOpenInput;
  resourceKey(resource: ResourceRef): string;
}) => {
  if (!input.target.resource) return input.state;
  return input.page.slots.reduce((state, slot) => {
    const followsPrimaryResource =
      slot.role === "auxiliary" &&
      slot.defaultOpen &&
      slot.binding?.resourceKind === input.target.resource?.type &&
      !slot.defaultResource;
    if (!followsPrimaryResource) return state;
    return openResourceSlot({
      slot,
      state,
      target: { pageId: input.page.id, resource: input.target.resource },
      resourceKey: input.resourceKey,
    });
  }, input.state);
};

export const setStaticSlotOpen = (state: WorkbenchPageRuntimeState, slotId: string, open: boolean) => {
  const ids = new Set(state.openStaticSlotIds);
  if (open) ids.add(slotId);
  else ids.delete(slotId);
  return { ...state, openStaticSlotIds: [...ids] };
};

export const removeResourceInstance = (state: WorkbenchPageRuntimeState, slotId: string, instanceKey: string) => {
  const current = state.resourceInstances[slotId] ?? [];
  const resourceInstances = {
    ...state.resourceInstances,
    [slotId]: current.filter((candidate) => candidate.instanceKey !== instanceKey),
  };
  return { ...state, resourceInstances };
};

export type ClosePageSlotResult =
  | { kind: "stay"; state: WorkbenchPageRuntimeState; activateInstanceKey?: string }
  | { kind: "parent"; state: WorkbenchPageRuntimeState; parentId: string };

export const closePageSlot = (input: {
  page: WorkbenchPageContribution;
  slot: WorkbenchPageSlot;
  state: WorkbenchPageRuntimeState;
  instanceKey: string;
}): ClosePageSlotResult => {
  const { page, slot, instanceKey } = input;
  const state =
    instanceKey === "default"
      ? setStaticSlotOpen(input.state, slot.id, false)
      : removeResourceInstance(input.state, slot.id, instanceKey);
  if (slot.role === "auxiliary") return { kind: "stay", state };

  const remaining = state.resourceInstances[slot.id] ?? [];
  if (remaining.length > 0) {
    const previousActive = state.activePrimaryInstanceKey;
    const activateInstanceKey =
      previousActive && previousActive !== instanceKey ? previousActive : remaining.at(-1)?.instanceKey;
    return { kind: "stay", state: { ...state, activePrimaryInstanceKey: activateInstanceKey }, activateInstanceKey };
  }
  if (slot.viewId) {
    return { kind: "stay", state: { ...state, activePrimaryInstanceKey: "default" }, activateInstanceKey: "default" };
  }
  if (!page.parentId) throw new Error(`Bound-only page has no parent: ${page.id}`);
  return { kind: "parent", state, parentId: page.parentId };
};
