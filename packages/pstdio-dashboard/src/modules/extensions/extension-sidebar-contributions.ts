import type { WorkbenchModuleContributionContext } from "pstdio-workbench/core";
import {
  buildDashboardExtensionTreeSections,
  type DashboardExtensionMetadata,
  getCachedDashboardExtensionMetadata,
} from "@/shared/extensions/workbench-extension-contributions";
import {
  registerProjectSidebarContribution,
  sidebarTreeContributionPlacements,
} from "@/shared/workbench/contributions/sidebar-tree-contributions";
import { buildExtensionDataRendererSidebarSections } from "./extension-data-renderers";

interface ExtensionSidebarContributionState {
  metadata: DashboardExtensionMetadata | undefined;
  projectId: string | undefined;
}

const extensionNavigationMetadata = (state: ExtensionSidebarContributionState) =>
  getCachedDashboardExtensionMetadata(state.projectId) ?? state.metadata;

export const registerExtensionSidebarContributions = (
  ctx: WorkbenchModuleContributionContext,
  getState: () => ExtensionSidebarContributionState,
) => {
  registerProjectSidebarContribution(ctx, {
    id: "dashboard.extensions.project-sidebar.first",
    order: 10,
    placement: sidebarTreeContributionPlacements.beforeWorkspaces,
    getSections: () => {
      const state = getState();
      if (!state.projectId) return [];
      const metadata = extensionNavigationMetadata(state);
      return metadata
        ? buildDashboardExtensionTreeSections({
            metadata,
            modeId: "project",
            placement: "first",
            projectId: state.projectId,
            target: "workbench.left.tree",
          })
        : [];
    },
  });
  registerProjectSidebarContribution(ctx, {
    id: "dashboard.extensions.data-renderers",
    order: 15,
    getSections: () => {
      const state = getState();
      return buildExtensionDataRendererSidebarSections({
        metadata: extensionNavigationMetadata(state),
        projectId: state.projectId,
      });
    },
  });
  registerProjectSidebarContribution(ctx, {
    id: "dashboard.extensions.project-sidebar.default",
    order: 20,
    getSections: () => {
      const state = getState();
      if (!state.projectId) return [];
      const metadata = extensionNavigationMetadata(state);
      return metadata
        ? buildDashboardExtensionTreeSections({
            metadata,
            modeId: "project",
            placement: "default",
            projectId: state.projectId,
            target: "workbench.left.tree",
          })
        : [];
    },
  });
};
