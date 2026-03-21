export type GlobalSettingsPanel = "agents";

export const parseSettingsPanel = (panel: unknown): GlobalSettingsPanel => {
  if (panel === "agents") {
    return "agents";
  }

  return "agents";
};

export const toSettingsPanel = (panel: GlobalSettingsPanel) => panel;
