import type { TreeNode, TreeViewSection } from "pstdio-workbench/core";
import {
  createDashboardSettingsSkillResource,
  createDashboardSettingsTemplateResource,
  dashboardSettingsResources,
} from "../../shared/resources";
import type { ProjectTemplateAsset, ProjectTemplateAssetType } from "../../shared/runtime/project-types";
import type { ProjectSkill } from "./data/skills-api";

const TEMPLATE_TYPE_CONFIG: Record<ProjectTemplateAssetType, { icon: string; label: string }> = {
  prompt: { icon: "MessageSquareText", label: "Prompts" },
  ticket: { icon: "Ticket", label: "Tickets" },
  document: { icon: "FileText", label: "Documents" },
};

const TEMPLATE_TYPE_ORDER: ProjectTemplateAssetType[] = ["prompt", "ticket", "document"];

interface BuildDashboardSettingsTreeInput {
  hasProject: boolean;
  skills: ProjectSkill[];
  templates: ProjectTemplateAsset[];
  onCreateTemplate?: () => void;
}

const resourceNode = (resource: (typeof dashboardSettingsResources)[keyof typeof dashboardSettingsResources]) =>
  ({
    id: resource.uri,
    label: resource.label ?? resource.id ?? resource.uri,
    icon: resource.icon,
    resource,
  }) satisfies TreeNode;

const skillNode = (skill: ProjectSkill) => {
  const resource = createDashboardSettingsSkillResource(skill.name);
  return {
    id: resource.uri,
    label: skill.name,
    resource,
  } satisfies TreeNode;
};

const templateNode = (template: ProjectTemplateAsset) => {
  const resource = createDashboardSettingsTemplateResource(template.name);
  return {
    id: resource.uri,
    label: template.name,
    resource,
  } satisfies TreeNode;
};

const buildTemplateNodes = (source: "project" | "extension", templates: ProjectTemplateAsset[]) => {
  const grouped: Partial<Record<ProjectTemplateAssetType, ProjectTemplateAsset[]>> = {};

  for (const template of templates) {
    const list = grouped[template.templateType] ?? [];
    list.push(template);
    grouped[template.templateType] = list;
  }

  return TEMPLATE_TYPE_ORDER.filter((type) => grouped[type]).map((type) => {
    const config = TEMPLATE_TYPE_CONFIG[type];
    return {
      id: `${source}-template-group:${type}`,
      label: config.label,
      icon: config.icon,
      collapsible: true,
      children: grouped[type]!.map(templateNode),
    } satisfies TreeNode;
  });
};

const splitTemplates = (templates: ProjectTemplateAsset[]) => {
  const projectTemplates: ProjectTemplateAsset[] = [];
  const extensionTemplates: ProjectTemplateAsset[] = [];

  for (const template of templates) {
    if (template.sourceKind === "extension") {
      extensionTemplates.push(template);
    } else {
      projectTemplates.push(template);
    }
  }

  return { projectTemplates, extensionTemplates };
};

export const buildDashboardSettingsTree = (input: BuildDashboardSettingsTreeInput) => {
  const { hasProject, skills, templates, onCreateTemplate } = input;
  const runtimeNode = resourceNode(dashboardSettingsResources.runtime);
  const harnessNode = resourceNode(dashboardSettingsResources.harnesses);

  if (!hasProject) {
    return [
      {
        id: "runtime-harnesses",
        nodes: [runtimeNode, harnessNode],
      },
    ] satisfies TreeViewSection[];
  }

  const { projectTemplates, extensionTemplates } = splitTemplates(templates);
  const projectTemplatesSection = {
    id: "project-templates",
    label: "Project templates",
    ...(onCreateTemplate
      ? {
          actions: [
            {
              id: "create-template",
              label: "Create template",
              icon: "Plus",
              run: onCreateTemplate,
            },
          ],
        }
      : {}),
    nodes: buildTemplateNodes("project", projectTemplates),
  } satisfies TreeViewSection;

  const sections: TreeViewSection[] = [
    {
      id: "project-settings",
      nodes: [
        runtimeNode,
        harnessNode,
        resourceNode(dashboardSettingsResources.extensions),
        resourceNode(dashboardSettingsResources.repositories),
      ],
    },
    {
      id: "workspaces",
      label: "Workspaces",
      nodes: [resourceNode(dashboardSettingsResources.attemptStatuses)],
    },
    {
      id: "general",
      nodes: [
        {
          id: "skills",
          label: "Skills",
          icon: "BookOpen",
          collapsible: true,
          children: skills.map(skillNode),
        },
      ],
    },
    projectTemplatesSection,
  ];

  if (extensionTemplates.length > 0) {
    sections.push({
      id: "extension-templates",
      label: "Extension templates",
      nodes: buildTemplateNodes("extension", extensionTemplates),
    });
  }

  sections.push({
    id: "danger",
    nodes: [resourceNode(dashboardSettingsResources.dangerZone)],
  });

  return sections;
};
