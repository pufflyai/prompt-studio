import type { ThemePreferenceMode } from "@pstdio/ui";

interface DesktopActivityItem {
  id: string;
  label: string;
}

export interface DesktopActivity {
  sessions: DesktopActivityItem[];
  terminals: DesktopActivityItem[];
  jobs: DesktopActivityItem[];
}

export interface DesktopLifecycleState {
  kind: string;
  activity?: DesktopActivity;
}

export interface DesktopStartupAppearance {
  themeId: string;
  mode: ThemePreferenceMode;
  tokens: Record<string, string>;
  backgroundColor: string;
}

export interface DesktopLifecycleBridge {
  getStartupState: () => Promise<DesktopLifecycleState>;
  onStartupState: (listener: (state: DesktopLifecycleState) => void) => () => void;
  cancelQuit: () => Promise<void>;
  confirmQuit: () => Promise<void>;
  setStartupAppearance: (appearance: DesktopStartupAppearance) => Promise<void>;
}

const methods = ["getStartupState", "onStartupState", "cancelQuit", "confirmQuit", "setStartupAppearance"] as const;

export const resolveDesktopLifecycleBridge = (bridge: unknown) => {
  if (!bridge || typeof bridge !== "object") return undefined;
  const candidate = bridge as Record<string, unknown>;
  return methods.every((method) => typeof candidate[method] === "function")
    ? (bridge as DesktopLifecycleBridge)
    : undefined;
};
