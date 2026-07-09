import { standardResourceIcons, type WorkbenchModuleContributionContext } from "@pstdio/workbench/core";
import { settingsPanelResource } from "@pstdio/workbench/react";
import { dashboardCommandIds } from "@/shared/app/commands";
import { getDashboardSelectedProjectId, getDashboardSelectedProjectName } from "@/shared/app/project-context";
import { createProjectTemplate, getProjectTemplateAssets } from "@/shared/projects/project-api";
import type { ProjectTemplateAsset, ProjectTemplateAssetType } from "@/shared/projects/project-types";
import { ExtensionsPanel } from "./components/extensions-panel";
import { ProjectDangerZone } from "./components/project-danger-zone";
import { ProjectRepositoriesPanel } from "./components/project-repositories-panel";
import { RuntimeSettingsPanel } from "./components/runtime-settings-panel";
import { SkillViewer } from "./components/skill-viewer";
import { TemplateSettingsEditor } from "./components/template-settings-editor";
import { getProjectSkills, type ProjectSkill } from "./data/skills-api";

// The default settings entry opened by the command/sidebar. It is global, so it
// stays reachable even when no project is selected.
export const dashboardSettingsDefaultPanel = { id: "runtime", title: "Runtime", icon: standardResourceIcons.settings };

const TEMPLATE_GROUP_ORDER: ProjectTemplateAssetType[] = ["prompt", "ticket", "document"];
const TEMPLATE_GROUP_LABELS: Record<ProjectTemplateAssetType, string> = {
  prompt: "Prompts",
  ticket: "Tickets",
  document: "Documents",
};

const nextTemplateName = (existingNames: string[]) => {
  const taken = new Set(existingNames);
  if (!taken.has("new-template")) return "new-template";
  let index = 2;
  while (taken.has(`new-template-${index}`)) index += 1;
  return `new-template-${index}`;
};

// Registers the dashboard's settings sections and panels against the workbench
// settings registry. The unified surface (`createWorkbenchSettingsModule`) turns
// these into the navigation tree and dispatching panel.
export const registerDashboardSettingsContributions = (ctx: WorkbenchModuleContributionContext) => {
  ctx.settings.registerSection({ id: "workbench", title: "Workbench", order: 10, scope: "global" });
  ctx.settings.registerSection({ id: "project", title: "Project", order: 20, scope: "project" });

  ctx.settings.registerPanel({
    kind: "custom",
    id: "runtime",
    title: "Runtime",
    section: "workbench",
    scope: "global",
    order: 10,
    icon: "Cpu",
    render: () => <RuntimeSettingsPanel projectId={getDashboardSelectedProjectId(ctx)} />,
  });

  ctx.settings.registerPanel({
    kind: "custom",
    id: "extensions",
    title: "Extensions",
    section: "project",
    scope: "project",
    order: 10,
    icon: "Puzzle",
    render: () => <ExtensionsPanel projectId={getDashboardSelectedProjectId(ctx)} />,
  });

  ctx.settings.registerPanel({
    kind: "custom",
    id: "repositories",
    title: "Repositories",
    section: "project",
    scope: "project",
    order: 20,
    icon: "GitBranch",
    render: () => <ProjectRepositoriesPanel projectId={getDashboardSelectedProjectId(ctx)} />,
  });

  ctx.settings.registerPanel<ProjectSkill>({
    kind: "collection",
    id: "skills",
    title: "Skills",
    section: "project",
    scope: "project",
    order: 30,
    icon: "Sparkles",
    items: () => {
      const projectId = getDashboardSelectedProjectId(ctx);
      return projectId ? getProjectSkills(projectId) : [];
    },
    itemId: (skill) => skill.name,
    itemLabel: (skill) => skill.title || skill.name,
    renderItem: (skill) => <SkillViewer projectId={getDashboardSelectedProjectId(ctx)} skillName={skill.name} />,
  });

  ctx.settings.registerPanel<ProjectTemplateAsset>({
    kind: "collection",
    id: "templates",
    title: "Templates",
    section: "project",
    scope: "project",
    order: 40,
    icon: "FileText",
    items: () => {
      const projectId = getDashboardSelectedProjectId(ctx);
      return projectId ? getProjectTemplateAssets(projectId) : [];
    },
    itemId: (template) => template.id,
    itemLabel: (template) => template.title || template.name,
    groupBy: {
      key: (template) => template.templateType,
      order: TEMPLATE_GROUP_ORDER,
      label: (key) => TEMPLATE_GROUP_LABELS[key as ProjectTemplateAssetType] ?? key,
    },
    renderItem: (template) => (
      <TemplateSettingsEditor
        key={template.id}
        template={template}
        onDeleted={() => {
          ctx.settings.refresh();
          void ctx.resources.openResource(settingsPanelResource(dashboardSettingsDefaultPanel), {
            replaceActive: true,
          });
        }}
      />
    ),
    actions: [
      {
        id: "create",
        label: "New template",
        icon: "Plus",
        run: async () => {
          const projectId = getDashboardSelectedProjectId(ctx);
          if (!projectId) return;
          const existing = await getProjectTemplateAssets(projectId);
          await createProjectTemplate(projectId, {
            name: nextTemplateName(existing.map((template) => template.name)),
            templateType: "prompt",
            content: "",
          });
          ctx.settings.refresh();
        },
      },
    ],
  });

  ctx.settings.registerPanel({
    kind: "custom",
    id: "danger-zone",
    title: "Danger zone",
    section: "project",
    scope: "project",
    order: 90,
    icon: "TriangleAlert",
    render: (input) => (
      <ProjectDangerZone
        projectId={getDashboardSelectedProjectId(ctx)}
        projectName={getDashboardSelectedProjectName(ctx) ?? "Project"}
        onDeleted={() => void input.workbench.commands.executeCommand(dashboardCommandIds.clearSelectedProject)}
      />
    ),
  });
};
