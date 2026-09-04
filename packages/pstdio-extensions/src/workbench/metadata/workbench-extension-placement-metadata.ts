import type { WorkbenchExtensionMetadata } from "@pstdio/sdk/api";
import type { ResourceKindRef } from "@pstdio/sdk/extensions";
import type { ExtensionRuntime, RuntimePageSlot, RuntimePlacementTab } from "../../types/runtime";
import { normalizedRef, normalizeTarget, refreshEventIds } from "./workbench-extension-metadata-normalizers";

type MetadataPageSlot = WorkbenchExtensionMetadata["pages"][number]["slots"][number];
type MetadataSlotBinding = NonNullable<Extract<MetadataPageSlot, { role: "primary" }>["binding"]>;

const bindingRecord = (binding: NonNullable<RuntimePageSlot["binding"]>, extensionId: string): MetadataSlotBinding => ({
  kind: Array.isArray(binding.kind)
    ? binding.kind.map((kind) => normalizedRef(kind, extensionId))
    : normalizedRef(binding.kind as ResourceKindRef, extensionId),
  view: normalizedRef(binding.view, extensionId),
  cardinality: binding.cardinality,
  add: binding.add ? (normalizeTarget(binding.add, extensionId) as MetadataSlotBinding["add"]) : undefined,
});

const tabRecord = (tab: RuntimePlacementTab | undefined, extensionId: string) =>
  tab
    ? {
        queryHandlerId: tab.queryHandlerId,
        refreshEventIds: refreshEventIds(tab.refreshEvents, extensionId),
      }
    : undefined;

const slotRecord = (slot: RuntimePageSlot, extensionId: string): MetadataPageSlot => {
  const base = {
    id: slot.id,
    region: slot.region,
    order: slot.order,
    mountStrategy: slot.mountStrategy,
    hiddenByDefault: slot.hiddenByDefault,
    headerBorderBottom: slot.headerBorderBottom,
    floatingPanels: slot.floatingPanels,
    tab: tabRecord(slot.tab, extensionId),
  };
  if (slot.role === "primary") {
    return {
      ...base,
      role: "primary",
      view: slot.view ? normalizedRef(slot.view, extensionId) : undefined,
      binding: slot.binding ? bindingRecord(slot.binding, extensionId) : undefined,
    };
  }
  if (slot.view) {
    return {
      ...base,
      role: "auxiliary",
      view: normalizedRef(slot.view, extensionId),
      presence: slot.presence,
    };
  }
  return {
    ...base,
    role: "auxiliary",
    binding: bindingRecord(slot.binding, extensionId),
    openOn: slot.openOn,
  };
};

export const toPageRecords = (runtime: ExtensionRuntime): WorkbenchExtensionMetadata["pages"] =>
  runtime.pages.map((page) => ({
    id: page.id,
    localId: page.localId,
    extensionId: page.extensionId,
    title: page.contribution.title,
    icon: page.contribution.icon,
    path: page.contribution.path,
    mode: normalizedRef(page.contribution.mode, page.extensionId),
    parent: page.contribution.parent ? normalizedRef(page.contribution.parent, page.extensionId) : undefined,
    slots: page.contribution.slots.map((slot) => slotRecord(slot, page.extensionId)),
  }));

export const toPlacementRecords = (runtime: ExtensionRuntime): WorkbenchExtensionMetadata["placements"] =>
  runtime.placements.map((placement) => ({
    id: placement.id,
    localId: placement.localId,
    extensionId: placement.extensionId,
    mode: normalizedRef(placement.contribution.mode, placement.extensionId),
    item:
      placement.contribution.item.kind === "view"
        ? {
            kind: "view",
            view: normalizedRef(placement.contribution.item.view, placement.extensionId),
            presence: placement.contribution.item.presence,
          }
        : {
            kind: "binding",
            resourceKind: Array.isArray(placement.contribution.item.resourceKind)
              ? placement.contribution.item.resourceKind.map((kind) => normalizedRef(kind, placement.extensionId))
              : normalizedRef(placement.contribution.item.resourceKind as ResourceKindRef, placement.extensionId),
            view: normalizedRef(placement.contribution.item.view, placement.extensionId),
            cardinality: placement.contribution.item.cardinality,
            add: placement.contribution.item.add
              ? (normalizeTarget(placement.contribution.item.add, placement.extensionId) as MetadataSlotBinding["add"])
              : undefined,
          },
    region: placement.contribution.region,
    order: placement.contribution.order,
    movableTo: placement.contribution.movableTo ? [...placement.contribution.movableTo] : undefined,
    mountStrategy: placement.contribution.mountStrategy,
    hiddenByDefault: placement.contribution.hiddenByDefault,
    headerBorderBottom: placement.contribution.headerBorderBottom,
    floatingPanels: placement.contribution.floatingPanels,
    tab: tabRecord(placement.contribution.tab, placement.extensionId),
  }));
