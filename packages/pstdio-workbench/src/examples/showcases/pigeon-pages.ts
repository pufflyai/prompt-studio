import type { PageRef } from "@pstdio/sdk/extensions";
import type { WorkbenchCore } from "../../core";
export const pigeonHomePage: PageRef = { extensionId: "preview.showcases", kind: "page", id: "pigeon" };
export const selectPigeonThread = (workbench: WorkbenchCore, id: string) => {
  workbench.pageLocations.updateParams({ selection: id });
  return workbench.navigation.openPanel({
    panel: { kind: "page-slot", page: pigeonHomePage, id: "reader" },
  });
};
