import type { DesktopState } from "./lifecycle/lifecycle-machine";

export interface DesktopAppInfo {
  platform: string;
  version: string;
}

export interface DesktopWorkbenchState {
  selectedProjectId?: string;
  pageLocations: Record<string, string>;
}

export interface DesktopProjectTabsState {
  projectIds: string[];
}

export interface PromptStudioDesktopApi {
  cancelQuit: () => Promise<void>;
  confirmQuit: () => Promise<void>;
  getAppInfo: () => Promise<DesktopAppInfo>;
  getStartupState: () => Promise<DesktopState>;
  onStartupState: (listener: (state: DesktopState) => void) => () => void;
  onCommand: (listener: (commandId: string) => void) => () => void;
  retryRuntime: () => Promise<void>;
  openLogs: () => Promise<void>;
  revealInFinder: (path: string) => Promise<void>;
  copyDiagnostics: () => Promise<void>;
  checkForUpdates: () => Promise<void>;
  quitApp: () => Promise<void>;
  getWorkbenchState: () => Promise<DesktopWorkbenchState>;
  getProjectTabs: () => Promise<DesktopProjectTabsState>;
  setProjectTabs: (state: DesktopProjectTabsState) => Promise<void>;
  setPageLocation: (projectId: string, value: string | null) => Promise<void>;
  setSelectedProjectId: (projectId: string | null) => Promise<void>;
}

export const DESKTOP_CHANNELS = {
  command: "pstdio:desktop:command",
  isFullScreen: "pstdio:desktop:is-full-screen",
  fullScreenChanged: "pstdio:desktop:full-screen-changed",
  titleBarAppearance: "pstdio:desktop:title-bar-appearance",
  cancelQuit: "pstdio:desktop:cancel-quit",
  confirmQuit: "pstdio:desktop:confirm-quit",
  appInfo: "pstdio:desktop:app-info",
  startupState: "pstdio:desktop:startup-state",
  startupStateChanged: "pstdio:desktop:startup-state-changed",
  retryRuntime: "pstdio:desktop:retry-runtime",
  openLogs: "pstdio:desktop:open-logs",
  revealInFinder: "pstdio:desktop:reveal-in-finder",
  copyDiagnostics: "pstdio:desktop:copy-diagnostics",
  checkForUpdates: "pstdio:desktop:check-for-updates",
  quitApp: "pstdio:desktop:quit-app",
  getWorkbenchState: "pstdio:desktop:get-workbench-state",
  getProjectTabs: "pstdio:desktop:get-project-tabs",
  setProjectTabs: "pstdio:desktop:set-project-tabs",
  setPageLocation: "pstdio:desktop:set-page-location",
  setSelectedProjectId: "pstdio:desktop:set-selected-project-id",
} as const;
