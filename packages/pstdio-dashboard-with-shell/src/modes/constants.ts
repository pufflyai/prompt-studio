export const MODES_MODULE_ID = "dashboard.modes";

export const SESSIONS_BROWSER_MODE_ID = "sessions-browser";
export const ZEN_MODE_ID = "zen";

export const MODE_SWITCHER_WIDGET_ID = "modes.switcher";

export interface ModeMeta {
  id: string;
  label: string;
  description: string;
  icon: string;
}

export const sessionsBrowserMode: ModeMeta = {
  id: SESSIONS_BROWSER_MODE_ID,
  label: "Sessions",
  description: "Project selector, sessions tree, and the active session.",
  icon: "MessageCircle",
};

export const zenMode: ModeMeta = {
  id: ZEN_MODE_ID,
  label: "Zen",
  description: "Empty workbench for testing.",
  icon: "Sparkles",
};

export const modeOrder = [sessionsBrowserMode, zenMode] as const;
