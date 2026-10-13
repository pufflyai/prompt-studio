import type { WorkbenchCore, WorkbenchModeContribution, WorkbenchPageContribution } from "../../core";

export interface WindowingFixtureOptions {
  pageModes?: boolean;
  contextNavigation?: boolean;
  changesPresence?: "open" | "fixed";
  pagePanels?: boolean;
  pageRegionSettings?: WorkbenchPageContribution["regionSettings"];
  mainView?: "files" | "webview";
  regionSettings?: WorkbenchModeContribution["regionSettings"];
  registerMode?(workbench: WorkbenchCore): void;
}
