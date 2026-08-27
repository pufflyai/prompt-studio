import type { Disposable, WorkbenchModuleContext } from "@pstdio/workbench";
import { dashboardWidgetIds } from "@/shared/app/widget-ids";
import { toWorkbenchContributionId } from "@/shared/extensions/contribution-ref";
import type { ResolvedWorkbenchExtensionMetadata } from "@/shared/extensions/extension-localization";
import { registerSidenavContribution } from "@/shared/workbench/contributions/sidenav-tree-contributions";

type Metadata = ResolvedWorkbenchExtensionMetadata;
type ResourceView = Metadata["resourceViews"][number];

const sameResourceSlot = (
  left: { id: string; resourceKind: { extensionId: string; id: string } },
  right: { id: string; resourceKind: { extensionId: string; id: string } },
) =>
  left.id === right.id &&
  left.resourceKind.extensionId === right.resourceKind.extensionId &&
  left.resourceKind.id === right.resourceKind.id;

const slotPlacements = (metadata: Metadata, edge: ResourceView) =>
  metadata.placements.filter(
    (placement) => placement.item.kind === "resource-slot" && sameResourceSlot(placement.item.slot, edge.slot),
  );

const isIntegratedResourceTree = (metadata: Metadata, edge: ResourceView) => {
  const view = metadata.views.find((candidate) => candidate.id === toWorkbenchContributionId(edge.view));
  if (view?.body.kind !== "tree") return false;
  const placements = slotPlacements(metadata, edge);
  return (
    placements.length > 0 &&
    placements.every(
      (placement) =>
        placement.region === "sidenav" && placement.mode.extensionId === "pstdio" && placement.mode.id === "project",
    )
  );
};

export const integratedResourceSidenavViews = (metadata: Metadata) =>
  metadata.resourceViews.filter((edge) => isIntegratedResourceTree(metadata, edge));

export const withoutIntegratedResourceSidenavViews = (metadata: Metadata): Metadata => {
  const integrated = integratedResourceSidenavViews(metadata);
  if (integrated.length === 0) return metadata;
  const integratedIds = new Set(integrated.map((edge) => edge.id));

  return {
    ...metadata,
    resourceViews: metadata.resourceViews.filter((edge) => !integratedIds.has(edge.id)),
    placements: metadata.placements.filter((placement) => {
      if (placement.item.kind !== "resource-slot") return true;
      const slot = placement.item.slot;
      return !integrated.some((edge) => sameResourceSlot(slot, edge.slot));
    }),
  };
};

const mirrorSelection = (ctx: WorkbenchModuleContext, viewId: string) => ({
  dispose: ctx.renderers.treeStore.subscribeSelector(
    (state) => state.statesByTreeId[viewId]?.selectedNodeId,
    (selectedNodeId) => {
      if (!ctx.renderers.getTreeRenderer(dashboardWidgetIds.dashboardSidenav)) return;
      ctx.renderers.setSelectedNode(dashboardWidgetIds.dashboardSidenav, selectedNodeId);
    },
  ),
});

export const registerExtensionResourceSidenav = (ctx: WorkbenchModuleContext, metadata: Metadata) => {
  const disposables: Disposable[] = [];
  const viewIds = new Set<string>();

  integratedResourceSidenavViews(metadata).forEach((edge, index) => {
    const viewId = toWorkbenchContributionId(edge.view);
    viewIds.add(viewId);
    disposables.push(mirrorSelection(ctx, viewId));

    const tree = ctx.renderers.getTreeRenderer(viewId);

    disposables.push(
      registerSidenavContribution(ctx, {
        id: `dashboard.extensions.resource-sidenav.${edge.id}`,
        modes: ["project"],
        order: 200 + index,
        defaultExpandedSectionIds: tree?.defaultExpandedSectionIds,
        getSections: async (_workbench, input) => {
          if (input.resource?.kind !== edge.resourceKind.id) return [];
          const sections = await ctx.renderers.getBody(viewId, { resource: input.resource, viewId });
          const selectedNodeId = ctx.renderers.getTreeState(viewId).selectedNodeId;
          if (selectedNodeId && ctx.renderers.getTreeRenderer(dashboardWidgetIds.dashboardSidenav)) {
            ctx.renderers.setSelectedNode(dashboardWidgetIds.dashboardSidenav, selectedNodeId);
          }
          return sections;
        },
      }),
    );
  });

  const refreshSubscription = ctx.renderers.onDidRefresh((event) => {
    if (!viewIds.has(event.treeId)) return;
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
