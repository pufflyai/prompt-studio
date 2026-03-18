import type { SettingsSection } from "../components/settings-sidebar";

export const parseSettingsPanel = (panel: unknown): SettingsSection => {
  if (panel === "startup-script") {
    return "startup-script";
  }

  if (panel === "danger-zone") {
    return "danger-zone";
  }

  if (typeof panel === "string" && panel.startsWith("template:")) {
    const templateName = panel.slice("template:".length);
    if (templateName) {
      return { template: templateName };
    }
  }

  return "tags";
};

export const toSettingsPanel = (section: SettingsSection) => {
  if (section === "tags") return "tags";
  if (section === "startup-script") return "startup-script";
  if (section === "danger-zone") return "danger-zone";
  return `template:${section.template}`;
};
