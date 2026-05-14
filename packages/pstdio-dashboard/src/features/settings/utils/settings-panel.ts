export type GlobalSettingsPanel = "runtime" | "agents";

export const parseSettingsPanel = (panel: unknown): GlobalSettingsPanel => {
  if (panel === "runtime") {
    return "runtime";
  }

  if (panel === "agents") {
    return "agents";
  }

  return "runtime";
};

export const toSettingsPanel = (panel: GlobalSettingsPanel) => panel;
