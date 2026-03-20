import type { SettingsSection } from "../components/settings-sidebar";

type TemplateLike = { name: string };

export const parseSettingsPanel = (panel: unknown): SettingsSection => {
  if (panel === "danger-zone") {
    return "danger-zone";
  }

  if (typeof panel === "string" && panel.startsWith("template:")) {
    const templateName = panel.slice("template:".length);
    if (templateName) {
      return { template: templateName };
    }
  }

  if (typeof panel === "string" && panel.startsWith("hook:")) {
    const hookName = panel.slice("hook:".length);
    if (hookName) {
      return { hook: hookName };
    }
  }

  return "tags";
};

export const toSettingsPanel = (section: SettingsSection) => {
  if (section === "tags") return "tags";
  if (section === "danger-zone") return "danger-zone";
  if (typeof section === "object" && "hook" in section) return `hook:${section.hook}`;
  return `template:${section.template}`;
};

export const ensureValidSettingsSection = (
  section: SettingsSection,
  templates: TemplateLike[] | undefined,
): SettingsSection => {
  if (section === "tags" || section === "danger-zone") {
    return section;
  }

  // Hook sections are always valid — the editor handles missing hooks
  if ("hook" in section) {
    return section;
  }

  if (!templates) {
    return section;
  }

  return templates.some((template) => template.name === section.template) ? section : "tags";
};
