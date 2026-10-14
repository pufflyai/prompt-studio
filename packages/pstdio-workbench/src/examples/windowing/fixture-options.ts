import type { Disposable, WorkbenchCore, WorkbenchModeContribution, WorkbenchPageContribution } from "../../core";

export interface WindowingFixtureOptions {
  removalControls?: boolean;
  pageModes?: boolean;
  contextNavigation?: boolean;
  changesPresence?: "open" | "fixed";
  pagePanels?: boolean;
  pageRegionSettings?: WorkbenchPageContribution["regionSettings"];
  mainView?: "files" | "webview";
  regionSettings?: WorkbenchModeContribution["regionSettings"];
  registerMode?(workbench: WorkbenchCore): Disposable;
}
