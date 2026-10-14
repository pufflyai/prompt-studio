import type { Disposable, WorkbenchCore, WorkbenchModeContribution, WorkbenchPageContribution } from "../../core";

export interface WindowingFixtureOptions {
  removalControls?: boolean;
  pageModes?: boolean;
  contextNavigation?: boolean;
  floatingSessionDefault?: boolean;
  sessionStarts?: boolean;
  sessionBackground?: "active" | "keep-mounted";
  sessionMountStrategy?: "active" | "keep-mounted";
  changesPresence?: "open" | "fixed";
  pagePanels?: boolean;
  pageRegionSettings?: WorkbenchPageContribution["regionSettings"];
  mainView?: "files" | "webview";
  regionSettings?: WorkbenchModeContribution["regionSettings"];
  registerMode?(workbench: WorkbenchCore): Disposable;
  registerPages?(workbench: WorkbenchCore): void;
}
