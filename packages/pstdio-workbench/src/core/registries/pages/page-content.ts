import { isPageContent } from "./page-main";
import type { WorkbenchPageRegistryStoreState } from "./page-registry-types";

export const resolvePageContent = <Value>(state: WorkbenchPageRegistryStoreState<Value>) => {
  const page = state.pages[state.activePageId ?? ""];
  return state.placements.find((placement) => placement.region === "main" && isPageContent(page, placement.identity))
    ?.value;
};
