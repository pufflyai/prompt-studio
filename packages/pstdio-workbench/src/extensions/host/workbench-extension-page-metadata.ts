import type { WorkbenchExtensionMetadata } from "@pstdio/sdk/api";
import { contributionRefId } from "@pstdio/sdk/extensions";
import type { WorkbenchPageMain, WorkbenchPageSlot } from "../../core";
import type { InternalWorkbenchExtensionMetadata } from "./internal-workbench-extension-metadata";

import type { WorkbenchExtensionTabMetadata } from "./workbench-extension-tab-presentation";
import { toWorkbenchPresentationSnapshot } from "./workbench-extension-tab-presentation";

type MetadataPage = WorkbenchExtensionMetadata["pages"][number];
interface PagePresentationInput {
  extensionId: string;
  placementId: string;
  projectId?: string;
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
  const empty =
    main.empty && "view" in main.empty
      ? {
          view: main.empty.view,
          breadcrumb: main.empty.breadcrumb
            ? toWorkbenchPresentationSnapshot(main.empty.breadcrumb, input.extensionId, input.projectId)
            : undefined,
        }
      : main.empty;
  if (main.kind === "panels") return { ...main, empty };
  return {
    ...main,
    empty,
    tab:
      main.tab && input.createTab
        ? input.createTab({ ...main.tab, extensionId: input.extensionId, placementId: input.placementId })
        : undefined,
  };
};
export const toInternalWorkbenchPages = (
  metadata: WorkbenchExtensionMetadata,
  input: Pick<PagePresentationInput, "createTab" | "projectId"> = {},
): InternalWorkbenchExtensionMetadata["pages"] =>
  metadata.pages.map((page) => ({
    id: page.id,
    ref: { extensionId: page.extensionId, kind: "page", id: page.localId },
    title: page.title,
    path: page.path,
    document: page.document,
    params: page.params,
    regionSettings: page.regionSettings,
    modeId: contributionRefId(page.mode),
    resource: page.resource,
    main: pageMain(page.main, { extensionId: page.extensionId, placementId: `${page.id}.$main`, ...input }),
    panelView: page.panelView,
    slots: page.slots.map((slot) =>
      pageSlot(slot, { extensionId: page.extensionId, placementId: `${page.id}.${slot.id}`, ...input }),
    ),
    ...(page.icon ? { icon: page.icon } : {}),
    ...(page.parent ? { parentId: contributionRefId(page.parent) } : {}),
  }));
