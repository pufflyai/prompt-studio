import type { Disposable, WorkbenchModuleContext } from "@pstdio/workbench";
import { dashboardWidgetIds } from "@/shared/app/widget-ids";
import {
  type DashboardExtensionMetadata,
  getCachedDashboardExtensionMetadata,
} from "@/shared/extensions/workbench-extension-contributions";
import { buildDashboardExtensionTreeSections } from "@/shared/extensions/workbench-extension-tree-sections";
import { registerSidenavContribution } from "@/shared/workbench/contributions/sidenav-tree-contributions";
import { panelResourceKind, resourceSidenavModeId } from "./extension-composition";

interface ExtensionSidenavContributionState {
  metadata: DashboardExtensionMetadata | undefined;
  projectId: string | undefined;
}

const extensionNavigationMetadata = (state: ExtensionSidenavContributionState) =>
  state.metadata ?? getCachedDashboardExtensionMetadata(state.projectId);

export const registerExtensionSidenavContributions = (
  ctx: WorkbenchModuleContext,
  getState: () => ExtensionSidenavContributionState,
) => {
  registerSidenavContribution(ctx, {
    id: "dashboard.extensions.project-sidenav.first",
    modes: ["*"],
    order: 10,
    getSections: (_workbench, input) => {
      const state = getState();
      if (!state.projectId) return [];
      const metadata = extensionNavigationMetadata(state);
      return metadata
        ? buildDashboardExtensionTreeSections({
            metadata,
            modeId: input.modeId,
            placement: "first",
            projectId: state.projectId,
            target: "workbench.left.tree",
          })
        : [];
    },
  });
  registerSidenavContribution(ctx, {
    id: "dashboard.extensions.project-sidenav.default",
    modes: ["*"],
    order: 40,
    getSections: (_workbench, input) => {
      const state = getState();
      if (!state.projectId) return [];
      const metadata = extensionNavigationMetadata(state);
      return metadata
        ? buildDashboardExtensionTreeSections({
            metadata,
            modeId: input.modeId,
            placement: "default",
            projectId: state.projectId,
            target: "workbench.left.tree",
          })
        : [];
    },
  });
};

const mirrorResourceTreeSelection = (
  ctx: WorkbenchModuleContext,
  input: { modeId: string; treeRendererId: string },
) => {
  const unsubscribe = ctx.renderers.treeStore.subscribeSelector(
    (state) => state.statesByTreeId[input.treeRendererId]?.selectedNodeId,
    (selectedNodeId) => {
      if (ctx.modes.getActiveModeId() !== input.modeId) return;
      if (!ctx.renderers.getTreeRenderer(dashboardWidgetIds.dashboardSidenav)) return;
      ctx.renderers.setSelectedNode(dashboardWidgetIds.dashboardSidenav, selectedNodeId);
    },
  );

  return { dispose: unsubscribe };
};

export const registerExtensionResourceSidenavContributions = (
  ctx: WorkbenchModuleContext,
  metadata: DashboardExtensionMetadata,
) => {
  const disposables: Disposable[] = [];
  const sidenavTreeIds = new Set<string>();

  for (const [index, view] of metadata.panels.entries()) {
    if (view.renderer?.kind !== "tree") continue;
    const resourceKind = panelResourceKind(metadata, view.id);
    const modeId = resourceSidenavModeId(metadata, view);
    if (!resourceKind || !modeId) continue;
    const treeRendererId = view.renderer.id;

    sidenavTreeIds.add(treeRendererId);
    disposables.push(mirrorResourceTreeSelection(ctx, { modeId, treeRendererId }));
    const tree = ctx.renderers.getTreeRenderer(treeRendererId);
    if (ctx.renderers.getTreeRenderer(dashboardWidgetIds.dashboardSidenav)) {
      for (const sectionId of tree?.defaultExpandedSectionIds ?? []) {
        ctx.renderers.setSectionExpanded(dashboardWidgetIds.dashboardSidenav, sectionId, true);
      }
    }

    disposables.push(
      registerSidenavContribution(ctx, {
        id: `dashboard.extensions.resource-sidenav.${view.id}`,
        modes: [modeId],
        // Navigation entries (extension tree items at 10/40) stay on top; the
        // active resource's own tree renders below them.
        order: 50 + index,
        getSections: async (_workbench, input) => {
          if (input.resource?.kind !== resourceKind) return [];
          const sections = await ctx.renderers.getBody(treeRendererId, {
            resource: input.resource,
            viewId: view.id,
          });
          const selectedNodeId = ctx.renderers.getTreeState(treeRendererId).selectedNodeId;
          if (selectedNodeId && ctx.renderers.getTreeRenderer(dashboardWidgetIds.dashboardSidenav)) {
            ctx.renderers.setSelectedNode(dashboardWidgetIds.dashboardSidenav, selectedNodeId);
          }
          return sections;
        },
      }),
    );
  }

  const refreshSubscription = ctx.renderers.onDidRefresh((event) => {
    if (!sidenavTreeIds.has(event.treeId)) return;
    if (ctx.renderers.getTreeRenderer(dashboardWidgetIds.dashboardSidenav)) {
      ctx.renderers.refresh(dashboardWidgetIds.dashboardSidenav);
    }
  });

  return {
    dispose() {
      refreshSubscription.dispose();
      for (let index = disposables.length - 1; index >= 0; index -= 1) disposables[index]?.dispose();
    },
  };
};
