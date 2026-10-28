import { isPageContent } from "./page-main";
import type { WorkbenchPageRegistry } from "./page-registry";
import { getWorkbenchPageRegistryInternals } from "./page-registry-internals";
import type { WorkbenchPageRegistryStoreState } from "./page-registry-types";

export const resolvePageContent = <Value>(state: WorkbenchPageRegistryStoreState<Value>) => {
  const page = state.pages[state.activePageId ?? ""];
  return state.placements.find((placement) => placement.region === "main" && isPageContent(page, placement.identity))
    ?.value;
};

/** Tabless page content owns Main's view menus outside the tab layout, including during a page transition. */
export const pageContentOwners = <Value>(registry: WorkbenchPageRegistry<Value>) => {
  const content = resolvePageContent(getWorkbenchPageRegistryInternals(registry).getPublishingState());
  return content ? [content] : [];
};
