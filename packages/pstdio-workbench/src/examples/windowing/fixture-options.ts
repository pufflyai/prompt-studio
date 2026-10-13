import type { WorkbenchCore, WorkbenchModeContribution } from "../../core";

export interface WindowingFixtureOptions {
  pageModes?: boolean;
  contextNavigation?: boolean;
  floatingSessionDefault?: boolean;
  changesPresence?: "open" | "fixed";
  pagePanels?: boolean;
  mainView?: "files" | "webview";
  regionSettings?: WorkbenchModeContribution["regionSettings"];
  registerMode?(workbench: WorkbenchCore): void;
}
