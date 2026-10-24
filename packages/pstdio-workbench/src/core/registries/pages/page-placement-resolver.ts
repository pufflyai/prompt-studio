import type { PlacementIdentity, ResourceRef } from "@pstdio/sdk/extensions";
import { contributionRefId } from "@pstdio/sdk/extensions";
import type { ResolvedOwnedPlacement } from "../layout/placement-reconciliation";
import { SINGLE_RESOURCE_INSTANCE_KEY } from "../placements/placement-instance-key";
import { isPageContent, isSingleViewPage, PAGE_MAIN_SLOT_ID, pageSlots, type ResolvedPageSlot } from "./page-main";
import type {
  WorkbenchPageContribution,
  WorkbenchPagePlacementInput,
  WorkbenchPageRuntimeState,
} from "./page-registry-types";
import { pageResourceBindingSlots, staticSlotOpen } from "./page-slot-lifecycle";

export const pagePlacementIdentity = (pageId: string, slotId: string, instanceKey: string): PlacementIdentity => ({
  kind: "page",
  pageId,
  slotId,
  instanceKey,
});

export const pageFollowerIdentities = (
  page: WorkbenchPageContribution,
  resource: ResourceRef | undefined,
  resourceKey: (resource: ResourceRef) => string,
) => {
  if (!resource) return [];
  return pageResourceBindingSlots(page, resource)
    .filter((slot) => slot.region !== "main")
    .filter((slot, index, slots) => slots.findIndex((candidate) => candidate.region === slot.region) === index)
    .map((slot) =>
      pagePlacementIdentity(
        page.id,
        slot.id,
        slot.item.kind === "binding" && slot.item.binding.cardinality === "one"
          ? SINGLE_RESOURCE_INSTANCE_KEY
          : resourceKey(resource),
      ),
    );
};

const validatePageSlots = (page: WorkbenchPageContribution) => {
  const ids = new Set<string>();
  for (const slot of page.slots) {
    if (isSingleViewPage(page) && slot.region === "main")
      throw new Error(`Page "${page.id}" has one Main view and cannot declare Main tab slots`);
    if (slot.id === PAGE_MAIN_SLOT_ID || ids.has(slot.id))
      throw new Error(`Page "${page.id}" declares duplicate or reserved slot "${slot.id}"`);
    ids.add(slot.id);
    if (slot.movableTo && !slot.movableTo.includes(slot.region))
      throw new Error(`Page slot "${slot.id}" must include its initial region in movableTo`);
    if (slot.item.kind === "binding" && slot.item.binding.kinds.length === 0)
      throw new Error(`Page slot "${slot.id}" must bind at least one resource kind`);
    if (slot.openOn && slot.item.kind !== "binding")
      throw new Error(`Page slot "${slot.id}" requires a binding for openOn`);
  }
  const main = page.main;
  if (
    main.kind === "panels" &&
    main.landing &&
    typeof main.landing === "string" &&
    !page.slots.some((slot) => slot.id === main.landing && slot.region === "main" && slot.item.kind === "view")
  ) {
    throw new Error(`Page "${page.id}" must declare a static Main landing slot`);
  }
};

export const validateWorkbenchPage = (page: WorkbenchPageContribution) => {
  if (page.ref.kind !== "page" || !page.ref.extensionId || !page.ref.id)
    throw new Error(`Page "${page.id}" must declare a normalized page ref`);
  if (page.path.startsWith("/") || page.path.endsWith("/"))
    throw new Error(`Page "${page.id}" must declare a normalized path`);
  if (!page.main || (page.main.kind !== "view" && page.main.kind !== "panels"))
    throw new Error(`Page "${page.id}" must declare Main content or a panel collection`);
  if (page.document && (!page.resource || !page.document.metadataKey.trim()))
    throw new Error(`Page "${page.id}" requires a document metadata key and routed resource`);
  if (page.resource && page.resource.kinds.length === 0)
    throw new Error(`Page "${page.id}" must accept at least one resource kind`);
  if (page.main.kind === "view" && page.main.cardinality === "many" && !page.resource)
    throw new Error(`Page "${page.id}" requires a resource for many cardinality`);
  if (page.main.kind === "view" && page.resource && !page.parentId)
    throw new Error(`Resource page "${page.id}" must declare a parent`);
  validatePageSlots(page);
};

const placementFor = <Value>(input: {
  page: WorkbenchPageContribution;
  slot: ResolvedPageSlot;
  instanceKey: string;
  resolvePagePlacement(value: WorkbenchPagePlacementInput): Value;
  resource?: ResourceRef;
  section?: WorkbenchPagePlacementInput["section"];
  position?: WorkbenchPagePlacementInput["position"];
  pageContext?: WorkbenchPagePlacementInput["pageContext"];
  open?: WorkbenchPagePlacementInput["open"];
}) => {
  const item = input.slot.item;
  const view = item.kind === "view" ? item.view : item.binding.view;
  const identity = pagePlacementIdentity(input.page.id, input.slot.id, input.instanceKey);
  return {
    identity,
    region: input.slot.region,
    order: input.slot.order ?? 0,
    value: input.resolvePagePlacement({
      identity,
      pageId: input.page.id,
      slotId: input.slot.id,
      role: input.slot.role,
      viewId: contributionRefId(view),
      ...(input.resource ? { resource: input.resource } : {}),
      ...(input.section ? { section: input.section } : {}),
      ...(input.position ? { position: input.position } : {}),
      pageContext: input.pageContext,
      ...(input.open ? { open: input.open } : {}),
      closable: !isPageContent(input.page, identity),
    }),
  } satisfies ResolvedOwnedPlacement<Value>;
};

export const resolvePagePlacements = <Value>(input: {
  page: WorkbenchPageContribution;
  state: WorkbenchPageRuntimeState;
  staticInstanceKey: string;
  resource?: ResourceRef;
  sharedPlacements: readonly ResolvedOwnedPlacement<Value>[];
  resolvePagePlacement(value: WorkbenchPagePlacementInput): Value;
}) => {
  const placements: ResolvedOwnedPlacement<Value>[] = [];
  for (const slot of pageSlots(input.page)) {
    if (slot.isAvailable && !slot.isAvailable(input.resource)) continue;
    if (staticSlotOpen(slot, input.state))
      placements.push(placementFor({ ...input, slot, instanceKey: input.staticInstanceKey }));
    const instances = input.state.resourceInstances[slot.id] ?? [];
    const visible =
      slot.role === "primary" && isSingleViewPage(input.page)
        ? instances.filter((instance) => instance.instanceKey === input.state.activePrimaryInstanceKey).slice(-1)
        : instances;
    for (const instance of visible) {
      placements.push(placementFor({ ...input, slot, ...instance }));
    }
  }
  return placements;
};
