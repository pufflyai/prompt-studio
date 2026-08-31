import type { WorkbenchExtensionMetadata } from "@pstdio/sdk/api";
import type { WorkbenchPageSlot } from "../../core";
import type { InternalWorkbenchExtensionMetadata } from "./internal-workbench-extension-metadata";
import { metadataRefId } from "./workbench-extension-metadata-ref";

type MetadataPageSlot = WorkbenchExtensionMetadata["pages"][number]["slots"][number];

const pageSlot = (slot: MetadataPageSlot): WorkbenchPageSlot => ({
  id: slot.id,
  role: slot.role,
  region: slot.region,
  ...(slot.view ? { viewId: metadataRefId(slot.view) } : {}),
  ...(slot.binding
    ? { binding: { resourceKind: slot.binding.kind.id, viewId: metadataRefId(slot.binding.view) } }
    : {}),
  ...(slot.cardinality ? { cardinality: slot.cardinality } : {}),
  ...(slot.closable === undefined ? {} : { closable: slot.closable }),
  ...(slot.defaultOpen === undefined ? {} : { defaultOpen: slot.defaultOpen }),
  ...(slot.defaultResource ? { defaultResource: slot.defaultResource as WorkbenchPageSlot["defaultResource"] } : {}),
  ...(slot.order === undefined ? {} : { order: slot.order }),
});

export const toInternalWorkbenchPages = (
  metadata: WorkbenchExtensionMetadata,
): InternalWorkbenchExtensionMetadata["pages"] =>
  metadata.pages.map((page) => ({
    id: page.id,
    ref: { extensionId: page.extensionId, kind: "page", id: page.localId },
    title: page.title,
    path: page.path,
    modeId: metadataRefId(page.mode),
    slots: page.slots.map(pageSlot),
    ...(page.icon ? { icon: page.icon } : {}),
    ...(page.parent ? { parentId: metadataRefId(page.parent) } : {}),
  }));
