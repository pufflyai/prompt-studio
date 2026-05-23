import type { WorkbenchModeActivationContext } from "pstdio-workbench/core";
import { getDashboardSelectedProjectId, subscribeDashboardSelectedProject } from "../../shared/project-context";
import { dashboardResources } from "../../shared/resources";
import { getProjectTemplateAssets } from "./data/project-api";
import { getProjectSkills } from "./data/skills-api";
import { buildDashboardSettingsTree } from "./settings-tree";

export const dashboardSettingsNavigationTreeViewId = "dashboard-workbench.settings.navigation";
export const dashboardCreateTemplateDialogOpenContextKey = "dashboard.settings.createTemplateDialogOpen";

const defaultExpandedNodeIds = [
  "skills",
  "project-template-group:prompt",
  "project-template-group:ticket",
  "project-template-group:document",
  "extension-template-group:prompt",
  "extension-template-group:ticket",
  "extension-template-group:document",
];

const getSettingsTreeBody = async (ctx: WorkbenchModeActivationContext) => {
  const projectId = getDashboardSelectedProjectId(ctx);
  if (!projectId) {
    return buildDashboardSettingsTree({ hasProject: false, skills: [], templates: [] });
  }

  const [templates, skills] = await Promise.all([getProjectTemplateAssets(projectId), getProjectSkills(projectId)]);
  return buildDashboardSettingsTree({
    hasProject: true,
    skills,
    templates,
    onCreateTemplate: () => {
      ctx.context.set(dashboardCreateTemplateDialogOpenContextKey, true);
      void ctx.resources.openResource(dashboardResources.settings, { replaceActive: true });
    },
  });
};

// Builds the settings navigation tree shown in the left area while the
// "settings" mode is active.
export const registerSettingsNavigation = (ctx: WorkbenchModeActivationContext) => {
  ctx.renderers.registerTreeRenderer({
    id: dashboardSettingsNavigationTreeViewId,
    title: "Project settings",
    defaultExpandedSectionIds: ["general", "project-templates", "extension-templates"],
    defaultExpandedNodeIds,
    getBody: () => getSettingsTreeBody(ctx),
    getChildren: () => [],
  });
  ctx.layout.registerWidget({
    id: dashboardSettingsNavigationTreeViewId,
    title: "Project settings",
    area: "left",
    rendererId: dashboardSettingsNavigationTreeViewId,
  });
  ctx.layout.clearArea("left");
  ctx.layout.openWidget(dashboardSettingsNavigationTreeViewId);

  const unsubscribeProject = subscribeDashboardSelectedProject(ctx, () => {
    ctx.renderers.refresh(dashboardSettingsNavigationTreeViewId);
  });
  return { dispose: unsubscribeProject };
};
