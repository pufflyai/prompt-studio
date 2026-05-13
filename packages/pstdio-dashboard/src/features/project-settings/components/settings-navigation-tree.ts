import type { ResourceRef, TreeNode, TreeViewSection } from "pstdio-shell/core";
import type { ProjectSkill } from "../data/skills-api";
import { parseSettingsPanel, toSettingsPanel } from "../utils/settings-panel";
import type { SettingsSection } from "../utils/settings-section";

export const PROJECT_SETTINGS_TREE_ID = "project.settings.navigation";
export const PROJECT_SETTINGS_SECTION_RESOURCE_KIND = "project-settings-section";
export const PROJECT_SETTINGS_SECTION_OPENER_ID = "project.settings.sectionOpener";
export const PROJECT_SETTINGS_CREATE_TAG_COMMAND_ID = "project.settings.createTag";
export const PROJECT_SETTINGS_CREATE_TEMPLATE_COMMAND_ID = "project.settings.createTemplate";

const TEMPLATE_TYPE_CONFIG: Record<ProjectTemplateAssetType, { icon: string; label: string }> = {
  prompt: { icon: "MessageSquareText", label: "Prompts" },
  ticket: { icon: "Ticket", label: "Tickets" },
  document: { icon: "FileText", label: "Documents" },
};

const TEMPLATE_TYPE_ORDER: ProjectTemplateAssetType[] = ["prompt", "ticket", "document"];

export type ProjectTemplateAssetType = "prompt" | "ticket" | "document";

export interface ProjectSettingsTemplateAsset {
  name: string;
  sourceKind: "project" | "extension";
  templateType: ProjectTemplateAssetType;
}

export interface ProjectSettingsTag {
  id: string;
  name: string;
}

export interface ProjectSettingsNavigationLabels {
  attemptStatuses: string;
  createTag: string;
  createTemplate: string;
  dangerZone: string;
  extensionTemplates: string;
  extensions: string;
  projectTemplates: string;
  repositories: string;
  skills: string;
  tags: string;
  harnesses: string;
}

export interface BuildProjectSettingsTreeSectionsInput {
  projectId: string;
  templates: ProjectSettingsTemplateAsset[];
  skills: ProjectSkill[];
  tags: ProjectSettingsTag[];
  labels: ProjectSettingsNavigationLabels;
}

export const createProjectSettingsSectionResource = (
  projectId: string,
  section: SettingsSection,
  label?: string,
  icon?: string,
): ResourceRef => {
  const panel = toSettingsPanel(section);

  return {
    kind: PROJECT_SETTINGS_SECTION_RESOURCE_KIND,
    uri: `pstdio://project/${projectId}/settings/${encodeURIComponent(panel)}`,
    id: panel,
    label,
    icon,
    metadata: { projectId, panel },
  };
};

export const parseProjectSettingsSectionResource = (resource: ResourceRef) => {
  const panel = typeof resource.metadata?.panel === "string" ? resource.metadata.panel : resource.id;
  return parseSettingsPanel(panel);
};

const createSectionNode = (projectId: string, section: SettingsSection, label: string, icon?: string): TreeNode => {
  const resource = createProjectSettingsSectionResource(projectId, section, label, icon);

  return {
    id: resource.uri,
    label,
    icon,
    resource,
  };
};

const buildTemplateNodes = (
  projectId: string,
  source: "project" | "extension",
  items: ProjectSettingsTemplateAsset[],
) => {
  const grouped: Partial<Record<ProjectTemplateAssetType, ProjectSettingsTemplateAsset[]>> = {};
  for (const template of items) {
    const list = grouped[template.templateType] ?? [];
    list.push(template);
    grouped[template.templateType] = list;
  }

  return TEMPLATE_TYPE_ORDER.filter((type) => grouped[type]).map((type) => {
    const config = TEMPLATE_TYPE_CONFIG[type];
    const templates = grouped[type]!;

    return {
      id: `${source}-template-group:${type}`,
      label: config.label,
      icon: config.icon,
      children: templates.map((template) => createSectionNode(projectId, { template: template.name }, template.name)),
    };
  });
};

export const buildProjectSettingsTreeSections = (input: BuildProjectSettingsTreeSectionsInput): TreeViewSection[] => {
  const { labels, projectId, skills, tags, templates } = input;
  const projectTemplates: ProjectSettingsTemplateAsset[] = [];
  const extensionTemplates: ProjectSettingsTemplateAsset[] = [];

  for (const template of templates) {
    const list = template.sourceKind === "extension" ? extensionTemplates : projectTemplates;
    list.push(template);
  }

  const tagNodes = tags.map((tag) => createSectionNode(projectId, { tag: tag.id }, tag.name));
  const skillNodes = skills.map((skill) => createSectionNode(projectId, { skill: skill.name }, skill.name));
  const projectTemplateNodes = buildTemplateNodes(projectId, "project", projectTemplates);
  const extensionTemplateNodes = buildTemplateNodes(projectId, "extension", extensionTemplates);

  const sections: TreeViewSection[] = [
    {
      id: "general",
      nodes: [
        createSectionNode(projectId, "ticket-statuses", "Statuses", "Ticket"),
        createSectionNode(projectId, "attempt-statuses", labels.attemptStatuses, "CircleDot"),
        {
          ...createSectionNode(projectId, "tags", labels.tags, "Tag"),
          children: tagNodes,
          actions: [
            {
              id: PROJECT_SETTINGS_CREATE_TAG_COMMAND_ID,
              label: labels.createTag,
              icon: "Plus",
              commandId: PROJECT_SETTINGS_CREATE_TAG_COMMAND_ID,
            },
          ],
        },
        {
          id: "skills",
          label: labels.skills,
          icon: "Sparkles",
          collapsible: true,
          children: skillNodes,
        },
      ],
    },
    {
      id: "project-templates",
      label: labels.projectTemplates,
      actions: [
        {
          id: PROJECT_SETTINGS_CREATE_TEMPLATE_COMMAND_ID,
          label: labels.createTemplate,
          icon: "Plus",
          commandId: PROJECT_SETTINGS_CREATE_TEMPLATE_COMMAND_ID,
        },
      ],
      nodes: projectTemplateNodes,
    },
    {
      id: "project-tools",
      nodes: [
        createSectionNode(projectId, "repositories", labels.repositories, "GitFork"),
        createSectionNode(projectId, "agents", labels.harnesses, "Bot"),
        createSectionNode(projectId, "extensions", labels.extensions, "Puzzle"),
      ],
    },
    {
      id: "danger",
      nodes: [createSectionNode(projectId, "danger-zone", labels.dangerZone, "AlertTriangle")],
    },
  ];

  if (extensionTemplates.length > 0) {
    sections.splice(2, 0, {
      id: "extension-templates",
      label: labels.extensionTemplates,
      nodes: extensionTemplateNodes,
    });
  }

  return sections;
};
