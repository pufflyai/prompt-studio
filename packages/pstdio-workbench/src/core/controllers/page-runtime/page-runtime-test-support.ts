import type { WorkbenchPageContribution } from "../../registries/pages/page-registry";
import type { WorkbenchCore } from "../../workbench-core";

export const registerResourcePage = (workbench: WorkbenchCore, page: WorkbenchPageContribution) => {
  const parentId = `${page.id}-collection`;
  if (page.resource && page.main.kind === "view" && !page.parentId) {
    workbench.pages.registerPage({
      id: parentId,
      ref: { ...page.ref, id: parentId },
      title: "Collection",
      path: parentId,
      modeId: page.modeId,
      main: { kind: "view", view: page.main.view, cardinality: "one" },
      slots: [],
    });
    return workbench.pages.registerPage({ ...page, parentId });
  }
  return workbench.pages.registerPage(page);
};
