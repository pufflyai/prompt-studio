import type { WorkbenchExtensionMetadata } from "@pstdio/sdk/api";
import type { NavigationTarget as ExtensionNavigationTarget, ResourceKindRef } from "@pstdio/sdk/extensions";
import type { WorkbenchPageSlot, WorkbenchPageSlotBinding } from "../../core";
import { toWorkbenchNavigationTarget } from "./extension-navigation-target";
import type { InternalWorkbenchExtensionMetadata } from "./internal-workbench-extension-metadata";
import { metadataRefId } from "./workbench-extension-metadata-ref";
import type { WorkbenchExtensionTabMetadata } from "./workbench-extension-tab-presentation";

type MetadataPageSlot = WorkbenchExtensionMetadata["pages"][number]["slots"][number];

interface PageSlotInput {
  extensionId: string;
  pageId: string;
  createTab?(metadata: WorkbenchExtensionTabMetadata): WorkbenchPageSlot["tab"];
}

const slotBinding = (
  binding: NonNullable<Extract<MetadataPageSlot, { binding: unknown }>["binding"]>,
  input: PageSlotInput,
): WorkbenchPageSlotBinding => ({
  resourceKinds: (Array.isArray(binding.kind) ? binding.kind : [binding.kind as ResourceKindRef]).map(
    (kind) => kind.id,
  ),
  viewId: metadataRefId(binding.view),
  cardinality: binding.cardinality,
  ...(binding.add
    ? { add: toWorkbenchNavigationTarget(binding.add as ExtensionNavigationTarget, { extensionId: input.extensionId }) }
    : {}),
});

const slotPresentation = (slot: MetadataPageSlot, input: PageSlotInput) => ({
  ...(slot.order === undefined ? {} : { order: slot.order }),
  ...(slot.mountStrategy ? { mountStrategy: slot.mountStrategy } : {}),
  ...(slot.hiddenByDefault === undefined ? {} : { hiddenByDefault: slot.hiddenByDefault }),
  ...(slot.headerBorderBottom === undefined ? {} : { headerBorderBottom: slot.headerBorderBottom }),
  ...(slot.tab && input.createTab
    ? {
        tab: input.createTab({
          ...slot.tab,
          extensionId: input.extensionId,
          placementId: `${input.pageId}.${slot.id}`,
        }),
      }
    : {}),
});

const pageSlot = (slot: MetadataPageSlot, input: PageSlotInput): WorkbenchPageSlot => {
  if (slot.role === "primary") {
    return {
      id: slot.id,
      role: "primary",
      region: "main",
      ...(slot.subPanelsOnly === undefined ? {} : { subPanelsOnly: slot.subPanelsOnly }),
      ...("binding" in slot ? { binding: slotBinding(slot.binding, input) } : { viewId: metadataRefId(slot.view) }),
      ...slotPresentation(slot, input),
    };
  }
  if ("binding" in slot) {
    return {
      id: slot.id,
      role: "auxiliary",
      region: slot.region,
      binding: slotBinding(slot.binding, input),
      ...("openOn" in slot && slot.openOn ? { openOn: slot.openOn } : {}),
      ...slotPresentation(slot, input),
    };
  }
  return {
    id: slot.id,
    role: "auxiliary",
    region: slot.region,
    viewId: metadataRefId(slot.view),
    presence: slot.presence,
    ...slotPresentation(slot, input),
  };
};

export const toInternalWorkbenchPages = (
  metadata: WorkbenchExtensionMetadata,
  createTab?: (metadata: WorkbenchExtensionTabMetadata) => WorkbenchPageSlot["tab"],
): InternalWorkbenchExtensionMetadata["pages"] =>
  metadata.pages.map((page) => ({
    id: page.id,
    ref: { extensionId: page.extensionId, kind: "page", id: page.localId },
    title: page.title,
    path: page.path,
    modeId: metadataRefId(page.mode),
    slots: page.slots.map((slot) => pageSlot(slot, { extensionId: page.extensionId, pageId: page.id, createTab })),
    ...(page.icon ? { icon: page.icon } : {}),
    ...(page.parent ? { parentId: metadataRefId(page.parent) } : {}),
  }));
