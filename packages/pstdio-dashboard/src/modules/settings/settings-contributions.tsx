import { standardResourceIcons, type WorkbenchModuleContext, type WorkbenchPanelRenderInput } from "@pstdio/workbench";
import { WORKBENCH_SETTINGS_OPEN_COMMAND_ID } from "@pstdio/workbench/react";
import { dashboardCommandIds } from "@/shared/app/commands";
import { getDashboardSelectedProjectId, getDashboardSelectedProjectName } from "@/shared/app/project-context";
import { dashboardEditableTemplatesContextKey } from "@/shared/extensions/workbench-extension-contributions";
import { ExtensionsPanel } from "./components/extensions-panel";
import { MachineTokensPanel } from "./components/machine-tokens-panel";
import { ProjectDangerZone } from "./components/project-danger-zone";
import { ProjectRepositoriesPanel } from "./components/project-repositories-panel";
import { RuntimeSettingsPanel } from "./components/runtime-settings-panel";
import { SkillViewer } from "./components/skill-viewer";
import { TemplateSettingsEditor } from "./components/template-settings-editor";
import { getProjectSkills, type ProjectSkill } from "./data/skills-api";
import {
  getProjectTemplateAssets,
  type ProjectTemplateAsset,
  templateTypesForProject,
} from "./data/template-provider-api";

// The default settings entry opened by the command/sidenav. It is global, so it
// stays reachable even when no project is selected.
export const dashboardSettingsDefaultPanel = { id: "runtime", title: "Runtime", icon: standardResourceIcons.settings };

const settingsViewIds = {
  runtime: "dashboard.settings.runtime",
  extensions: "dashboard.settings.extensions",
  repositories: "dashboard.settings.repositories",
  skill: "dashboard.settings.skill",
  template: "dashboard.settings.template",
  machineTokens: "dashboard.settings.machine-tokens",
  dangerZone: "dashboard.settings.danger-zone",
} as const;

const settingsItem = <TItem,>(input: WorkbenchPanelRenderInput, panelId: string) => {
  const itemId = input.instance.resource?.metadata?.itemId;
  return typeof itemId === "string"
    ? (input.workbench.settings.getCollectionItem(panelId, itemId) as TItem | undefined)
    : undefined;
};

// Registers the dashboard's settings sections and panels against the workbench
// settings registry. The unified surface (`createWorkbenchSettingsModule`) turns
// these into the navigation tree and dispatching panel.
export const registerDashboardSettingsContributions = (ctx: WorkbenchModuleContext) => {
  ctx.settings.registerSection({ id: "workbench", title: "Workbench", order: 10, scope: "global" });
  ctx.settings.registerSection({ id: "project", title: "Project", order: 20, scope: "project" });

  ctx.views.registerView({
    id: settingsViewIds.runtime,
    title: "Runtime",
    body: { kind: "react", render: () => <RuntimeSettingsPanel projectId={getDashboardSelectedProjectId(ctx)} /> },
  });
  ctx.views.registerView({
    id: settingsViewIds.extensions,
    title: "Extensions",
    body: { kind: "react", render: () => <ExtensionsPanel projectId={getDashboardSelectedProjectId(ctx)} /> },
  });
  ctx.views.registerView({
    id: settingsViewIds.repositories,
    title: "Repositories",
    body: {
      kind: "react",
      render: () => <ProjectRepositoriesPanel projectId={getDashboardSelectedProjectId(ctx)} />,
    },
  });
  ctx.views.registerView({
    id: settingsViewIds.skill,
    title: "Skill",
    body: {
      kind: "react",
      render: (input) => {
        const skill = settingsItem<ProjectSkill>(input, "skills");
        return skill ? <SkillViewer projectId={getDashboardSelectedProjectId(ctx)} skillName={skill.name} /> : null;
      },
    },
  });
  ctx.views.registerView({
    id: settingsViewIds.template,
    title: "Template",
    body: {
      kind: "react",
      render: (input) => {
        const template = settingsItem<ProjectTemplateAsset>(input, "templates");
        return template ? (
          <TemplateSettingsEditor
            key={template.id}
            template={template}
            onDeleted={() => {
              ctx.settings.refresh();
              void ctx.commands.executeCommand(WORKBENCH_SETTINGS_OPEN_COMMAND_ID, {
                panelId: dashboardSettingsDefaultPanel.id,
              });
            }}
          />
        ) : null;
      },
    },
  });
  ctx.views.registerView({
    id: settingsViewIds.machineTokens,
    title: "Machine tokens",
    body: { kind: "react", render: () => <MachineTokensPanel projectId={getDashboardSelectedProjectId(ctx)} /> },
  });
  ctx.views.registerView({
    id: settingsViewIds.dangerZone,
    title: "Danger zone",
    body: {
      kind: "react",
      render: (input) => (
        <ProjectDangerZone
          projectId={getDashboardSelectedProjectId(ctx)}
          projectName={getDashboardSelectedProjectName(ctx) ?? "Project"}
          onDeleted={() => void input.workbench.commands.executeCommand(dashboardCommandIds.clearSelectedProject)}
        />
      ),
    },
  });

  ctx.settings.registerPanel({
    kind: "view",
    id: "runtime",
    title: "Runtime",
    section: "workbench",
    scope: "global",
    order: 10,
    icon: "Cpu",
    viewId: settingsViewIds.runtime,
  });

  ctx.settings.registerPanel({
    kind: "view",
    id: "extensions",
    title: "Extensions",
    section: "project",
    scope: "project",
    order: 10,
    icon: "Puzzle",
    viewId: settingsViewIds.extensions,
  });

  ctx.settings.registerPanel({
    kind: "view",
    id: "repositories",
    title: "Repositories",
    section: "project",
    scope: "project",
    order: 20,
    icon: "GitBranch",
    viewId: settingsViewIds.repositories,
  });

  ctx.settings.registerPanel<ProjectSkill>({
    kind: "collection",
    viewId: settingsViewIds.skill,
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
  });

  ctx.settings.registerPanel<ProjectTemplateAsset>({
    kind: "collection",
    viewId: settingsViewIds.template,
    id: "templates",
    title: "Templates",
    section: "project",
    scope: "project",
    when: dashboardEditableTemplatesContextKey,
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
      order: templateTypesForProject(getDashboardSelectedProjectId(ctx) ?? "").map((type) => type.id),
      label: (key) =>
        templateTypesForProject(getDashboardSelectedProjectId(ctx) ?? "").find((type) => type.id === key)?.label ?? key,
    },
  });

  ctx.settings.registerPanel({
    kind: "view",
    id: "machine-tokens",
    title: "Machine tokens",
    section: "project",
    scope: "project",
    order: 50,
    icon: "KeyRound",
    viewId: settingsViewIds.machineTokens,
  });

  ctx.settings.registerPanel({
    kind: "view",
    id: "danger-zone",
    title: "Danger zone",
    section: "project",
    scope: "project",
    order: 90,
    icon: "TriangleAlert",
    viewId: settingsViewIds.dangerZone,
  });
};
