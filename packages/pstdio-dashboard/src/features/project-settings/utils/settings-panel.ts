import type { SettingsSection } from "../components/settings-sidebar";

type TemplateLike = { name: string };

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

export const ensureValidSettingsSection = (
  section: SettingsSection,
  templates: TemplateLike[] | undefined,
): SettingsSection => {
  if (section === "tags" || section === "startup-script" || section === "danger-zone") {
    return section;
  }

  if (!templates) {
    return section;
  }

  return templates.some((template) => template.name === section.template) ? section : "tags";
};
