import type { DesktopState } from "./lifecycle/lifecycle-machine";

export interface DesktopAppInfo {
  platform: string;
  version: string;
}

export interface PromptStudioDesktopApi {
  getAppInfo: () => Promise<DesktopAppInfo>;
  getStartupState: () => Promise<DesktopState>;
  retryRuntime: () => Promise<void>;
  openLogs: () => Promise<void>;
  copyDiagnostics: () => Promise<void>;
  quitApp: () => Promise<void>;
}

export const DESKTOP_CHANNELS = {
  appInfo: "pstdio:desktop:app-info",
  startupState: "pstdio:desktop:startup-state",
  retryRuntime: "pstdio:desktop:retry-runtime",
  openLogs: "pstdio:desktop:open-logs",
  copyDiagnostics: "pstdio:desktop:copy-diagnostics",
  quitApp: "pstdio:desktop:quit-app",
} as const;
