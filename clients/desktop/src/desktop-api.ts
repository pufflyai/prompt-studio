import type { PerformanceSnapshot } from "pstdio-api-contracts/performance-diagnostics";
import type { DesktopState } from "./lifecycle/lifecycle-machine";

export interface DesktopAppInfo {
  platform: string;
  version: string;
}

/** Every saved dashboard workbench value, keyed by its browser storage key. */
export interface DesktopWorkbenchState {
  values: Record<string, string>;
}

/**
 * The theme the workbench last showed. Lifecycle screens use it before the runtime
 * and its extensions start, because contributed theme colors are not available then.
 */
export interface DesktopStartupAppearance {
  themeId: string;
  mode: "light" | "dark";
  /** Theme token overrides keyed by token path, such as `colors.bg`. */
  tokens: Record<string, string>;
  backgroundColor: string;
}

export interface DesktopProjectTabsState {
  projectIds: string[];
}

export interface PromptStudioDesktopApi {
  cancelQuit: () => Promise<void>;
  confirmQuit: () => Promise<void>;
  getAppInfo: () => Promise<DesktopAppInfo>;
  getStartupAppearance: () => Promise<DesktopStartupAppearance | null>;
  onStartupAppearance: (listener: (appearance: DesktopStartupAppearance) => void) => () => void;
  setStartupAppearance: (appearance: DesktopStartupAppearance) => Promise<void>;
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
  setWorkbenchItem: (key: string, value: string | null) => Promise<void>;
  getPerformanceMonitoring: () => Promise<boolean>;
  setPerformanceMonitoring: (enabled: boolean) => Promise<void>;
  getPerformanceSnapshot: () => Promise<PerformanceSnapshot | null>;
  reportSlowFrames: (report: unknown) => Promise<void>;
  reportRendererState: (report: unknown) => Promise<void>;
}

export const DESKTOP_CHANNELS = {
  command: "pstdio:desktop:command",
  isFullScreen: "pstdio:desktop:is-full-screen",
  fullScreenChanged: "pstdio:desktop:full-screen-changed",
  titleBarAppearance: "pstdio:desktop:title-bar-appearance",
  cancelQuit: "pstdio:desktop:cancel-quit",
  confirmQuit: "pstdio:desktop:confirm-quit",
  appInfo: "pstdio:desktop:app-info",
  getStartupAppearance: "pstdio:desktop:get-startup-appearance",
  startupAppearanceChanged: "pstdio:desktop:startup-appearance-changed",
  setStartupAppearance: "pstdio:desktop:set-startup-appearance",
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
  setWorkbenchItem: "pstdio:desktop:set-workbench-item",
  getPerformanceMonitoring: "pstdio:desktop:get-performance-monitoring",
  setPerformanceMonitoring: "pstdio:desktop:set-performance-monitoring",
  getPerformanceSnapshot: "pstdio:desktop:get-performance-snapshot",
  reportSlowFrames: "pstdio:desktop:report-slow-frames",
  reportRendererState: "pstdio:desktop:report-renderer-state",
} as const;
