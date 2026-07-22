import type { Disposable, WorkbenchModuleContributionContext } from "@pstdio/workbench/core";
import { dashboardWidgetIds } from "@/shared/app/widget-ids";
import {
  buildDashboardExtensionTreeSections,
  type DashboardExtensionMetadata,
  getCachedDashboardExtensionMetadata,
} from "@/shared/extensions/workbench-extension-contributions";
import { registerSidebarContribution } from "@/shared/workbench/contributions/sidebar-tree-contributions";
import { buildExtensionDataRendererSidebarHeaderNodes } from "./extension-data-renderers";

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

export const registerExtensionDataRendererSidebarContribution = (
  ctx: WorkbenchModuleContributionContext,
  input: { metadata: DashboardExtensionMetadata; projectId: string },
) =>
  registerSidebarContribution(ctx, {
    id: "dashboard.extensions.data-renderers",
    modes: ["*"],
    region: "header",
    order: 40,
    getHeaderNodes: () => buildExtensionDataRendererSidebarHeaderNodes(input),
  });

const resourceSidebarModeId = (
  metadata: DashboardExtensionMetadata,
  view: DashboardExtensionMetadata["views"][number],
) => {
  const mode = metadata.modes.find((candidate) => candidate.resourceKind === view.resourceKind);
  const modeTarget = mode?.layout?.open?.find((entry) => entry.view === view.id)?.target;
  return (modeTarget ?? view.target) === "workbench.left" ? (mode?.modeId ?? "project") : undefined;
};

export const isExtensionResourceSidebarView = (
  metadata: DashboardExtensionMetadata,
  view: DashboardExtensionMetadata["views"][number],
) => Boolean(view.resourceKind && view.treeRendererId && resourceSidebarModeId(metadata, view));

export const registerExtensionResourceSidebarContributions = (
  ctx: WorkbenchModuleContributionContext,
  metadata: DashboardExtensionMetadata,
) => {
  const disposables: Disposable[] = [];
  const sidebarTreeIds = new Set<string>();

  for (const [index, view] of metadata.views.entries()) {
    if (!isExtensionResourceSidebarView(metadata, view) || !view.resourceKind || !view.treeRendererId) continue;
    const treeRendererId = view.treeRendererId;
    const modeId = resourceSidebarModeId(metadata, view);
    if (!modeId) continue;

    sidebarTreeIds.add(treeRendererId);
    const tree = ctx.renderers.getTreeRenderer(treeRendererId);
    if (ctx.renderers.getTreeRenderer(dashboardWidgetIds.dashboardSidebar)) {
      for (const sectionId of tree?.defaultExpandedSectionIds ?? []) {
        ctx.renderers.setSectionExpanded(dashboardWidgetIds.dashboardSidebar, sectionId, true);
      }
    }

    disposables.push(
      registerSidebarContribution(ctx, {
        id: `dashboard.extensions.resource-sidebar.${view.id}`,
        modes: [modeId],
        order: index,
        getSections: async (_workbench, input) => {
          if (input.resource?.kind !== view.resourceKind) return [];
          const sections = await ctx.renderers.getBody(treeRendererId, {
            resource: input.resource,
            viewId: view.id,
          });
          const selectedNodeId = ctx.renderers.getTreeState(treeRendererId).selectedNodeId;
          if (selectedNodeId && ctx.renderers.getTreeRenderer(dashboardWidgetIds.dashboardSidebar)) {
            ctx.renderers.setSelectedNode(dashboardWidgetIds.dashboardSidebar, selectedNodeId);
          }
          return sections;
        },
      }),
    );
  }

  const refreshSubscription = ctx.renderers.onDidRefresh((event) => {
    if (!sidebarTreeIds.has(event.treeId)) return;
    if (ctx.renderers.getTreeRenderer(dashboardWidgetIds.dashboardSidebar)) {
      ctx.renderers.refresh(dashboardWidgetIds.dashboardSidebar);
    }
  });

  return {
    dispose() {
      refreshSubscription.dispose();
      for (let index = disposables.length - 1; index >= 0; index -= 1) disposables[index]?.dispose();
    },
  };
};
