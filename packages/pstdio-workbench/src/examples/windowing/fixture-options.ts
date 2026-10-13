import type { Disposable, WorkbenchCore, WorkbenchModeContribution } from "../../core";

export interface WindowingFixtureOptions {
  removalControls?: boolean;
  pageModes?: boolean;
  contextNavigation?: boolean;
  changesPresence?: "open" | "fixed";
  pagePanels?: boolean;
  mainView?: "files" | "webview";
  regionSettings?: WorkbenchModeContribution["regionSettings"];
  registerMode?(workbench: WorkbenchCore): Disposable;
}
