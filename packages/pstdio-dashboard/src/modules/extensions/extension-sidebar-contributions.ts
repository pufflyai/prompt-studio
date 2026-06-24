import type { WorkbenchModuleContributionContext } from "pstdio-workbench/core";
import {
  buildDashboardExtensionTreeSections,
  type DashboardExtensionMetadata,
  getCachedDashboardExtensionMetadata,
} from "@/shared/extensions/workbench-extension-contributions";
import { registerSidebarContribution } from "@/shared/workbench/contributions/sidebar-tree-contributions";
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
  registerSidebarContribution(ctx, {
    id: "dashboard.extensions.project-sidebar.first",
    modes: ["project"],
    order: 10,
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
  registerSidebarContribution(ctx, {
    id: "dashboard.extensions.data-renderers",
    modes: ["project"],
    order: 30,
    getSections: () => {
      const state = getState();
      return buildExtensionDataRendererSidebarSections({
        metadata: extensionNavigationMetadata(state),
        projectId: state.projectId,
      });
    },
  });
  registerSidebarContribution(ctx, {
    id: "dashboard.extensions.project-sidebar.default",
    modes: ["project"],
    order: 40,
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
