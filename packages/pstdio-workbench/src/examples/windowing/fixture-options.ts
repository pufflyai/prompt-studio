import type { WorkbenchCore, WorkbenchModeContribution } from "../../core";

export interface WindowingFixtureOptions {
  pagePanels?: boolean;
  mainView?: "files" | "webview";
  regionSettings?: WorkbenchModeContribution["regionSettings"];
  registerMode?(workbench: WorkbenchCore): void;
}
