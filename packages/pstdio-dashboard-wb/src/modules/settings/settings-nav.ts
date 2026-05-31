import type { WorkbenchModeActivationContext } from "pstdio-workbench/core";
import { getDashboardSelectedProjectId, subscribeDashboardSelectedProject } from "@/shared/app/project-context";
import { dashboardResources } from "@/shared/app/resources";
import { getProjectExtensionMetadata } from "@/shared/extensions/api";
import {
  emptyDashboardExtensionMetadata,
  getCachedDashboardExtensionMetadata,
  setCachedDashboardExtensionMetadata,
  subscribeDashboardExtensionMetadata,
} from "@/shared/extensions/workbench-extension-contributions";
import { getProjectTemplateAssets } from "@/shared/projects/project-api";
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
    return buildDashboardSettingsTree({ extensionSettingsPanels: [], hasProject: false, skills: [], templates: [] });
  }

  const [templates, skills, metadata] = await Promise.all([
    getProjectTemplateAssets(projectId),
    getProjectSkills(projectId),
    getCachedDashboardExtensionMetadata(projectId)
      ? Promise.resolve(getCachedDashboardExtensionMetadata(projectId)!)
      : getProjectExtensionMetadata(projectId)
          .then((nextMetadata) => {
            setCachedDashboardExtensionMetadata(projectId, nextMetadata);
            return nextMetadata;
          })
          .catch(() => emptyDashboardExtensionMetadata),
  ]);
  return buildDashboardSettingsTree({
    extensionSettingsPanels: metadata.settingsPanels,
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
  const unsubscribeExtensionMetadata = subscribeDashboardExtensionMetadata(() => {
    ctx.renderers.refresh(dashboardSettingsNavigationTreeViewId);
  });
  return {
    dispose() {
      unsubscribeProject();
      unsubscribeExtensionMetadata();
    },
  };
};
