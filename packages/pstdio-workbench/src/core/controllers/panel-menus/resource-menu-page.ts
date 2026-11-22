import type { WorkbenchCore } from "../../workbench-core-types";

/** An authored preview keeps its page context; its Resources projection has its own semantic page. */
export const getResourceMenuPage = (core: Pick<WorkbenchCore, "pages" | "viewMenus">, viewId: string | undefined) => {
  const menu = core.viewMenus.listViewMenus().find((menu) => menu.viewId === viewId && menu.purpose === "resources");
  const config = menu?.config;
  if (!config || typeof config !== "object" || !("pageId" in config) || typeof config.pageId !== "string") return;
  return core.pages.store.getState().pages[config.pageId];
};
