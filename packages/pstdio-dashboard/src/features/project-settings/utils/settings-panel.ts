import type { SettingsSection } from "../components/settings-sidebar";

type TemplateLike = { name: string };
type SkillLike = { name: string };
type TagLike = { id: string };
type ExtensionSettingsPanelLike = { id: string; scope?: "global" | "project" };
type StaticSettingsSection = Extract<SettingsSection, string>;

const PROJECTLESS_SECTIONS = new Set<SettingsSection>(["runtime"]);
const PANEL_STATIC_SECTIONS: Partial<Record<string, StaticSettingsSection>> = {
  runtime: "runtime",
  "ticket-statuses": "ticket-statuses",
  "attempt-statuses": "attempt-statuses",
  repositories: "repositories",
  extensions: "extensions",
  "danger-zone": "danger-zone",
};

const isProjectExtensionSettingsPanel = (panel: ExtensionSettingsPanelLike) =>
  panel.scope === undefined || panel.scope === "project";

const parseDynamicSettingsPanel = (panel: string): Exclude<SettingsSection, string> | undefined => {
  const dynamicSections = [
    { prefix: "tag:", create: (id: string) => ({ tag: id }) },
    { prefix: "template:", create: (id: string) => ({ template: id }) },
    { prefix: "skill:", create: (id: string) => ({ skill: id }) },
    { prefix: "extension-settings:", create: (id: string) => ({ extensionSettingsPanel: id }) },
  ];

  for (const section of dynamicSections) {
    if (!panel.startsWith(section.prefix)) continue;
    const id = panel.slice(section.prefix.length);
    if (id) return section.create(id);
  }

  return undefined;
};

export const parseSettingsPanel = (panel: unknown): SettingsSection => {
  if (typeof panel !== "string") return "tags";
  return PANEL_STATIC_SECTIONS[panel] ?? parseDynamicSettingsPanel(panel) ?? "tags";
};

export const toSettingsPanel = (section: SettingsSection) => {
  if (section === "runtime") return "runtime";
  if (section === "ticket-statuses") return "ticket-statuses";
  if (section === "attempt-statuses") return "attempt-statuses";
  if (section === "tags") return "tags";
  if (section === "extensions") return "extensions";
  if (section === "repositories") return "repositories";
  if (section === "danger-zone") return "danger-zone";
  if (typeof section === "object" && "tag" in section) return `tag:${section.tag}`;
  if (typeof section === "object" && "skill" in section) return `skill:${section.skill}`;
  if (typeof section === "object" && "extensionSettingsPanel" in section) {
    return `extension-settings:${section.extensionSettingsPanel}`;
  }
  return `template:${section.template}`;
};

const PROJECT_STATIC_SECTIONS = new Set<SettingsSection>([
  "runtime",
  "ticket-statuses",
  "attempt-statuses",
  "tags",
  "extensions",
  "repositories",
  "danger-zone",
]);

const ensureKnownValue = <TItem, TSection extends SettingsSection>(
  section: TSection,
  items: TItem[] | undefined,
  fallback: StaticSettingsSection,
  predicate: (item: TItem) => boolean,
) => {
  if (!items) return section;
  return items.some(predicate) ? section : fallback;
};

const ensureExtensionSettingsPanelSection = (
  section: { extensionSettingsPanel: string },
  extensionSettingsPanels: ExtensionSettingsPanelLike[] | undefined,
) =>
  ensureKnownValue(section, extensionSettingsPanels, "extensions", (panel) => {
    return panel.id === section.extensionSettingsPanel && isProjectExtensionSettingsPanel(panel);
  });

export const ensureValidSettingsSection = (
  section: SettingsSection,
  templates: TemplateLike[] | undefined,
  skills: SkillLike[] | undefined,
  tags: TagLike[] | undefined,
  extensionSettingsPanels?: ExtensionSettingsPanelLike[],
): SettingsSection => {
  if (typeof section === "string" && PROJECT_STATIC_SECTIONS.has(section)) {
    return section;
  }

  if (typeof section === "object" && "tag" in section) {
    return ensureKnownValue(section, tags, "tags", (tag) => tag.id === section.tag);
  }

  if (typeof section === "object" && "skill" in section) {
    return ensureKnownValue(section, skills, "tags", (skill) => skill.name === section.skill);
  }

  if (typeof section === "object" && "template" in section) {
    return ensureKnownValue(section, templates, "tags", (template) => template.name === section.template);
  }

  if (typeof section === "object" && "extensionSettingsPanel" in section) {
    return ensureExtensionSettingsPanelSection(section, extensionSettingsPanels);
  }

  return "tags";
};

export const isProjectlessSection = (section: SettingsSection) => {
  if (typeof section !== "string") return false;
  return PROJECTLESS_SECTIONS.has(section);
};
