import type { DesktopState } from "./lifecycle/lifecycle-machine";

export interface DesktopAppInfo {
  platform: string;
  version: string;
}

export interface PromptStudioDesktopApi {
  cancelQuit: () => Promise<void>;
  confirmQuit: () => Promise<void>;
  getAppInfo: () => Promise<DesktopAppInfo>;
  getStartupState: () => Promise<DesktopState>;
  retryRuntime: () => Promise<void>;
  openLogs: () => Promise<void>;
  revealInFinder: (path: string) => Promise<void>;
  copyDiagnostics: () => Promise<void>;
  quitApp: () => Promise<void>;
}

export const DESKTOP_CHANNELS = {
  cancelQuit: "pstdio:desktop:cancel-quit",
  confirmQuit: "pstdio:desktop:confirm-quit",
  appInfo: "pstdio:desktop:app-info",
  startupState: "pstdio:desktop:startup-state",
  retryRuntime: "pstdio:desktop:retry-runtime",
  openLogs: "pstdio:desktop:open-logs",
  revealInFinder: "pstdio:desktop:reveal-in-finder",
  copyDiagnostics: "pstdio:desktop:copy-diagnostics",
  quitApp: "pstdio:desktop:quit-app",
} as const;
