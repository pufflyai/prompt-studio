import type { WorkbenchExtensionMetadata } from "@pstdio/sdk/api";
import type { WorkbenchPageMain, WorkbenchPageSlot } from "../../core";
import type { InternalWorkbenchExtensionMetadata } from "./internal-workbench-extension-metadata";
import { metadataRefId } from "./workbench-extension-metadata-ref";
import type { WorkbenchExtensionTabMetadata } from "./workbench-extension-tab-presentation";

type MetadataPage = WorkbenchExtensionMetadata["pages"][number];
interface PagePresentationInput {
  extensionId: string;
  placementId: string;
  createTab?(metadata: WorkbenchExtensionTabMetadata): WorkbenchPageSlot["tab"];
}
const pageSlot = (slot: MetadataPage["slots"][number], input: PagePresentationInput): WorkbenchPageSlot => ({
  ...slot,
  tab:
    slot.tab && input.createTab
      ? input.createTab({ ...slot.tab, extensionId: input.extensionId, placementId: input.placementId })
      : undefined,
});
const pageMain = (main: MetadataPage["main"], input: PagePresentationInput): WorkbenchPageMain => {
  if (main.kind === "panels") return main;
  return {
    ...main,
    tab:
      main.tab && input.createTab
        ? input.createTab({ ...main.tab, extensionId: input.extensionId, placementId: input.placementId })
        : undefined,
  };
};
export const toInternalWorkbenchPages = (
  metadata: WorkbenchExtensionMetadata,
  createTab?: PagePresentationInput["createTab"],
): InternalWorkbenchExtensionMetadata["pages"] =>
  metadata.pages.map((page) => ({
    id: page.id,
    ref: { extensionId: page.extensionId, kind: "page", id: page.localId },
    title: page.title,
    path: page.path,
    modeId: metadataRefId(page.mode),
    resource: page.resource,
    main: pageMain(page.main, { extensionId: page.extensionId, placementId: `${page.id}.$main`, createTab }),
    slots: page.slots.map((slot) =>
      pageSlot(slot, { extensionId: page.extensionId, placementId: `${page.id}.${slot.id}`, createTab }),
    ),
    ...(page.icon ? { icon: page.icon } : {}),
    ...(page.parent ? { parentId: metadataRefId(page.parent) } : {}),
  }));
