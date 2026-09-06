import type { PageOpenIntent, ResourceRef } from "@pstdio/sdk/extensions";
import { resourceMatchesConstraint } from "../../shared/contributions/reference-id";
import { primarySlot, type ResolvedPageSlot } from "./page-main";
import type {
  WorkbenchPageContribution,
  WorkbenchPageOpenInput,
  WorkbenchPageRuntimeState,
  WorkbenchPageSlotInstance,
} from "./page-registry-types";

export { primarySlot, requirePageSlot } from "./page-main";

export const emptyPageState = (page: WorkbenchPageContribution): WorkbenchPageRuntimeState => ({
  openStaticSlotIds: page.slots
    .filter((slot) => slot.item.kind === "view" && slot.item.presence === "open")
    .map((slot) => slot.id),
  resourceInstances: {},
});

export const staticSlotOpen = (slot: ResolvedPageSlot, state: WorkbenchPageRuntimeState) =>
  slot.item.kind === "view" && (slot.item.presence === "fixed" || state.openStaticSlotIds.includes(slot.id));

const nextResourceInstances = (
  slot: ResolvedPageSlot,
  current: readonly WorkbenchPageSlotInstance[],
  instance: WorkbenchPageSlotInstance,
) => {
  if (slot.item.kind !== "binding" || slot.item.binding.cardinality !== "many") return [instance];
  const existing = current.find((candidate) => candidate.instanceKey === instance.instanceKey);
  const open: PageOpenIntent = existing?.open === "pin" || instance.open === "pin" ? "pin" : "preview";
  return [
    ...current.filter(
      (candidate) => candidate.instanceKey !== instance.instanceKey && (open === "pin" || candidate.open === "pin"),
    ),
    { ...instance, open },
  ];
};

export const openResourceSlot = (input: {
  slot: ResolvedPageSlot;
  state: WorkbenchPageRuntimeState;
  target: WorkbenchPageOpenInput;
  resourceKey(resource: ResourceRef): string;
}) => {
  const { slot, state, target } = input;
  if (slot.item.kind !== "binding") throw new Error(`Page slot "${slot.id}" does not accept a resource`);
  const binding = slot.item.binding;
  if (!target.resource) throw new Error(`Page slot "${slot.id}" requires a resource`);
  if (!resourceMatchesConstraint(binding, target.resource))
    throw new Error(`Page slot "${slot.id}" does not accept resource kind "${target.resource.type}"`);
  if (target.open && binding.cardinality !== "many")
    throw new Error(`Page slot "${slot.id}" accepts open intent only with many cardinality`);
  const instanceKey = input.resourceKey(target.resource);
  const instance: WorkbenchPageSlotInstance = {
    instanceKey,
    resource: target.resource,
    ...(target.section ? { section: target.section } : {}),
    ...(binding.cardinality === "many" ? { open: target.open ?? "preview" } : {}),
  };
  return {
    ...state,
    resourceInstances: {
      ...state.resourceInstances,
      [slot.id]: nextResourceInstances(slot, state.resourceInstances[slot.id] ?? [], instance),
    },
    ...(slot.role === "primary" ? { activePrimaryInstanceKey: instanceKey } : {}),
  } satisfies WorkbenchPageRuntimeState;
};

export const selectPrimaryTarget = (input: {
  page: WorkbenchPageContribution;
  state: WorkbenchPageRuntimeState;
  target: WorkbenchPageOpenInput;
  resourceKey(resource: ResourceRef): string;
}) => {
  const { page, target } = input;
  if (page.resource) {
    if (!target.resource) throw new Error(`Page "${page.id}" requires a resource`);
    if (!resourceMatchesConstraint(page.resource, target.resource))
      throw new Error(`Page "${page.id}" does not accept resource kind "${target.resource.type}"`);
  } else if (target.resource) throw new Error(`Page "${page.id}" does not accept a resource`);
  const slot = primarySlot(page);
  if (!slot) {
    if (target.open) throw new Error(`Panel collection page "${page.id}" does not accept an open intent`);
    return input.state;
  }
  if (target.resource) return openResourceSlot({ ...input, slot });
  if (target.open) throw new Error(`Page "${page.id}" accepts open intent only with a resource`);
  return { ...input.state, activePrimaryInstanceKey: "default" };
};

export const pageResourceBindingSlots = (page: WorkbenchPageContribution, resource: ResourceRef | undefined) =>
  page.slots.filter(
    (slot) =>
      slot.item.kind === "binding" &&
      slot.openOn === "page-resource" &&
      resource &&
      resourceMatchesConstraint(slot.item.binding, resource),
  );

export const openPageResourceBindings = (input: {
  page: WorkbenchPageContribution;
  state: WorkbenchPageRuntimeState;
  target: WorkbenchPageOpenInput;
  resourceKey(resource: ResourceRef): string;
}) => {
  if (!input.target.resource) return input.state;
  return pageResourceBindingSlots(input.page, input.target.resource).reduce(
    (state, slot) =>
      openResourceSlot({
        slot: { ...slot, role: "auxiliary" },
        state,
        target: { pageId: input.page.id, resource: input.target.resource },
        resourceKey: input.resourceKey,
      }),
    input.state,
  );
};

export const setStaticSlotOpen = (state: WorkbenchPageRuntimeState, slotId: string, open: boolean) => {
  const ids = new Set(state.openStaticSlotIds);
  if (open) ids.add(slotId);
  else ids.delete(slotId);
  return { ...state, openStaticSlotIds: [...ids] };
};

export const removeResourceInstance = (state: WorkbenchPageRuntimeState, slotId: string, instanceKey: string) => ({
  ...state,
  resourceInstances: {
    ...state.resourceInstances,
    [slotId]: (state.resourceInstances[slotId] ?? []).filter((instance) => instance.instanceKey !== instanceKey),
  },
});

export type ClosePageSlotResult =
  | { kind: "stay"; state: WorkbenchPageRuntimeState; activateInstanceKey?: string }
  | { kind: "parent"; state: WorkbenchPageRuntimeState; parentId: string };

export const closePageSlot = (input: {
  page: WorkbenchPageContribution;
  slot: ResolvedPageSlot;
  state: WorkbenchPageRuntimeState;
  instanceKey: string;
}): ClosePageSlotResult => {
  const { page, slot, instanceKey } = input;
  if (slot.item.kind === "view" && slot.item.presence === "fixed")
    throw new Error(`Page slot "${slot.id}" is fixed and cannot close`);
  const state =
    instanceKey === "default"
      ? setStaticSlotOpen(input.state, slot.id, false)
      : removeResourceInstance(input.state, slot.id, instanceKey);
  if (slot.role === "auxiliary") return { kind: "stay", state };
  const remaining = state.resourceInstances[slot.id] ?? [];
  if (remaining.length) {
    const previous = state.activePrimaryInstanceKey;
    const activateInstanceKey = previous && previous !== instanceKey ? previous : remaining.at(-1)?.instanceKey;
    return { kind: "stay", state: { ...state, activePrimaryInstanceKey: activateInstanceKey }, activateInstanceKey };
  }
  if (!page.parentId) throw new Error(`Resource page has no parent: ${page.id}`);
  return { kind: "parent", state, parentId: page.parentId };
};
