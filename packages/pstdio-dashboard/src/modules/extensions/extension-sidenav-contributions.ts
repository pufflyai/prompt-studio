import type { Disposable, WorkbenchModuleContext } from "@pstdio/workbench";
import { dashboardWidgetIds } from "@/shared/app/widget-ids";
import {
  buildDashboardExtensionTreeSections,
  type DashboardExtensionMetadata,
  getCachedDashboardExtensionMetadata,
} from "@/shared/extensions/workbench-extension-contributions";
import { registerSidenavContribution } from "@/shared/workbench/contributions/sidenav-tree-contributions";
import { buildExtensionKanbanRendererSidenavHeaderNodes } from "./extension-kanban-renderers";

interface ExtensionSidenavContributionState {
  metadata: DashboardExtensionMetadata | undefined;
  projectId: string | undefined;
}

const extensionNavigationMetadata = (state: ExtensionSidenavContributionState) =>
  getCachedDashboardExtensionMetadata(state.projectId) ?? state.metadata;

export const registerExtensionSidenavContributions = (
  ctx: WorkbenchModuleContext,
  getState: () => ExtensionSidenavContributionState,
) => {
  registerSidenavContribution(ctx, {
    id: "dashboard.extensions.project-sidenav.first",
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
  registerSidenavContribution(ctx, {
    id: "dashboard.extensions.project-sidenav.default",
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

export const registerExtensionKanbanRendererSidenavContribution = (
  ctx: WorkbenchModuleContext,
  input: { metadata: DashboardExtensionMetadata; projectId: string },
) =>
  registerSidenavContribution(ctx, {
    id: "dashboard.extensions.kanban-renderers",
    modes: ["*"],
    region: "header",
    order: 40,
    getHeaderNodes: () => buildExtensionKanbanRendererSidenavHeaderNodes(input),
  });

const resourceSidenavModeId = (
  metadata: DashboardExtensionMetadata,
  panel: DashboardExtensionMetadata["panels"][number],
) => {
  const mode = metadata.modes.find((candidate) => candidate.resourceKind === panel.resourceKind);
  const modeRegion = mode?.layout?.open?.find((entry) => entry.panel === panel.id)?.region;
  return (modeRegion ?? panel.region) === "sidenav" ? (mode?.modeId ?? "project") : undefined;
};

export const isExtensionResourceSidenavView = (
  metadata: DashboardExtensionMetadata,
  panel: DashboardExtensionMetadata["panels"][number],
) => Boolean(panel.resourceKind && panel.treeRendererId && resourceSidenavModeId(metadata, panel));

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
    if (!isExtensionResourceSidenavView(metadata, view) || !view.resourceKind || !view.treeRendererId) continue;
    const treeRendererId = view.treeRendererId;
    const modeId = resourceSidenavModeId(metadata, view);
    if (!modeId) continue;

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
        order: index,
        getSections: async (_workbench, input) => {
          if (input.resource?.kind !== view.resourceKind) return [];
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
