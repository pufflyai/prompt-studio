import type { WorkbenchCore, WorkbenchModeContribution } from "../../core";

export interface WindowingFixtureOptions {
  pageModes?: boolean;
  contextNavigation?: boolean;
  sessionStarts?: boolean;
  sessionBackground?: "active" | "keep-mounted";
  sessionMountStrategy?: "active" | "keep-mounted";
  changesPresence?: "open" | "fixed";
  pagePanels?: boolean;
  mainView?: "files" | "webview";
  regionSettings?: WorkbenchModeContribution["regionSettings"];
  registerMode?(workbench: WorkbenchCore): void;
  registerPages?(workbench: WorkbenchCore): void;
}
