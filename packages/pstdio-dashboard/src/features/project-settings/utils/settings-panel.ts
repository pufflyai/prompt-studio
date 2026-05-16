import type { SettingsSection } from "../components/settings-sidebar";

type TemplateLike = { name: string };
type SkillLike = { name: string };
type TagLike = { id: string };

const PROJECTLESS_SECTIONS = new Set<SettingsSection>(["runtime", "harnesses"]);

export const parseSettingsPanel = (panel: unknown): SettingsSection => {
  if (panel === "runtime") return "runtime";
  if (panel === "harnesses") return "harnesses";
  if (panel === "ticket-statuses") return "ticket-statuses";
  if (panel === "attempt-statuses") return "attempt-statuses";
  if (panel === "repositories") return "repositories";
  if (panel === "extensions") return "extensions";
  if (panel === "danger-zone") return "danger-zone";

  if (typeof panel === "string" && panel.startsWith("tag:")) {
    const tagId = panel.slice("tag:".length);
    if (tagId) return { tag: tagId };
  }

  if (typeof panel === "string" && panel.startsWith("template:")) {
    const templateName = panel.slice("template:".length);
    if (templateName) return { template: templateName };
  }

  if (typeof panel === "string" && panel.startsWith("skill:")) {
    const skillName = panel.slice("skill:".length);
    if (skillName) return { skill: skillName };
  }

  return "tags";
};

export const toSettingsPanel = (section: SettingsSection) => {
  if (section === "runtime") return "runtime";
  if (section === "harnesses") return "harnesses";
  if (section === "ticket-statuses") return "ticket-statuses";
  if (section === "attempt-statuses") return "attempt-statuses";
  if (section === "tags") return "tags";
  if (section === "extensions") return "extensions";
  if (section === "repositories") return "repositories";
  if (section === "danger-zone") return "danger-zone";
  if (typeof section === "object" && "tag" in section) return `tag:${section.tag}`;
  if (typeof section === "object" && "skill" in section) return `skill:${section.skill}`;
  return `template:${section.template}`;
};

const PROJECT_STATIC_SECTIONS = new Set<SettingsSection>([
  "runtime",
  "harnesses",
  "ticket-statuses",
  "attempt-statuses",
  "tags",
  "extensions",
  "repositories",
  "danger-zone",
]);

export const ensureValidSettingsSection = (
  section: SettingsSection,
  templates: TemplateLike[] | undefined,
  skills: SkillLike[] | undefined,
  tags: TagLike[] | undefined,
): SettingsSection => {
  if (typeof section === "string" && PROJECT_STATIC_SECTIONS.has(section)) {
    return section;
  }

  if (typeof section === "object" && "tag" in section) {
    if (!tags) return section;
    return tags.some((t) => t.id === section.tag) ? section : "tags";
  }

  if (typeof section === "object" && "skill" in section) {
    if (!skills) return section;
    return skills.some((skill) => skill.name === section.skill) ? section : "tags";
  }

  if (typeof section === "object" && "template" in section) {
    if (!templates) return section;
    return templates.some((template) => template.name === section.template) ? section : "tags";
  }

  return "tags";
};

export const isProjectlessSection = (section: SettingsSection) => {
  if (typeof section !== "string") return false;
  return PROJECTLESS_SECTIONS.has(section);
};
