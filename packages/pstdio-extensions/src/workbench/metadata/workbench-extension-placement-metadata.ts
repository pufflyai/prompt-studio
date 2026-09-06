import type { WorkbenchExtensionMetadata } from "@pstdio/sdk/api";
import type { PlacementItem } from "@pstdio/sdk/extensions";
import type { ExtensionRuntime, RuntimePageMain, RuntimePageSlot, RuntimePlacementTab } from "../../types/runtime";
import { normalizedRef, normalizeTarget, refreshEventIds } from "./workbench-extension-metadata-normalizers";

type MetadataItem = WorkbenchExtensionMetadata["placements"][number]["item"];
const itemRecord = (item: PlacementItem, extensionId: string): MetadataItem => {
  if (item.kind === "view") return { ...item, view: normalizedRef(item.view, extensionId) };
  const { binding } = item;
  return {
    kind: "binding",
    binding: {
      kinds: binding.kinds.map((kind) => normalizedRef(kind, extensionId)),
      view: normalizedRef(binding.view, extensionId),
      cardinality: binding.cardinality,
      add: binding.add ? normalizeTarget(binding.add, extensionId) : undefined,
    },
  };
};
const tabRecord = (tab: RuntimePlacementTab | undefined, extensionId: string) =>
  tab
    ? {
        queryHandlerId: tab.queryHandlerId,
        refreshEventIds: refreshEventIds(tab.refreshEvents, extensionId),
      }
    : undefined;
const mainRecord = (main: RuntimePageMain, extensionId: string) => {
  if (main.kind === "panels") return { ...main, empty: normalizedRef(main.empty, extensionId) };
  return { ...main, view: normalizedRef(main.view, extensionId), tab: tabRecord(main.tab, extensionId) };
};
const slotRecord = (slot: RuntimePageSlot, extensionId: string) => ({
  ...slot,
  item: itemRecord(slot.item, extensionId),
  tab: tabRecord(slot.tab, extensionId),
});
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
    resource: page.contribution.resource
      ? { kinds: page.contribution.resource.kinds.map((kind) => normalizedRef(kind, page.extensionId)) }
      : undefined,
    main: mainRecord(page.contribution.main, page.extensionId),
    slots: page.contribution.slots.map((slot) => slotRecord(slot, page.extensionId)),
  }));
export const toPlacementRecords = (runtime: ExtensionRuntime): WorkbenchExtensionMetadata["placements"] =>
  runtime.placements.map((placement) => ({
    id: placement.id,
    localId: placement.localId,
    extensionId: placement.extensionId,
    mode: normalizedRef(placement.contribution.mode, placement.extensionId),
    item: itemRecord(placement.contribution.item, placement.extensionId),
    region: placement.contribution.region,
    order: placement.contribution.order,
    movableTo: placement.contribution.movableTo ? [...placement.contribution.movableTo] : undefined,
    mountStrategy: placement.contribution.mountStrategy,
    hiddenByDefault: placement.contribution.hiddenByDefault,
    headerBorderBottom: placement.contribution.headerBorderBottom,
    tab: tabRecord(placement.contribution.tab, placement.extensionId),
  }));
