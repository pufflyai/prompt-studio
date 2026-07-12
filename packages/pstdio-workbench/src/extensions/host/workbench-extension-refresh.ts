import type { WorkbenchExtensionMetadata } from "@pstdio/sdk/api";
import { text } from "pstdio-extensions/workbench";
import type { WorkbenchModuleContributionContext, WorkbenchWidgetPlacement } from "../../core";

const treeQueryCommandIds = (metadata: WorkbenchExtensionMetadata) =>
  new Set(
    (metadata.treeRenderers ?? []).flatMap((renderer) =>
      [renderer.bodyCommandId, renderer.childrenCommandId, renderer.footerCommandId].filter((commandId) => commandId),
    ),
  );

const dataRendererQueryCommandIds = (metadata: WorkbenchExtensionMetadata) =>
  new Set((metadata.dataRenderers ?? []).map((renderer) => renderer.queryCommandId));

const dataTableRendererQueryCommandIds = (metadata: WorkbenchExtensionMetadata) =>
  new Set((metadata.dataTableRenderers ?? []).map((renderer) => renderer.queryCommandId));

const findOpenPlacement = (
  workbench: WorkbenchModuleContributionContext,
  contributionId: string,
): WorkbenchWidgetPlacement | undefined => {
  const layout = workbench.layout.getLayout();

  for (const area of Object.values(layout.areas)) {
    const placement = area.widgets.find((candidate) => candidate.contributionId === contributionId);
    if (placement) return placement;
  }
};

const restoreActiveWidget = (workbench: WorkbenchModuleContributionContext, widgetId: string | undefined) => {
  if (!widgetId) return;
  try {
    workbench.layout.activateWidget(widgetId);
  } catch {
    // The refreshed widget may have been closed by the command.
  }
};

export const shouldRefreshWorkbenchExtensionTrees = (metadata: WorkbenchExtensionMetadata, commandId: string) =>
  !treeQueryCommandIds(metadata).has(commandId);

export const shouldRefreshWorkbenchExtensionDataRenderers = (metadata: WorkbenchExtensionMetadata, commandId: string) =>
  !dataRendererQueryCommandIds(metadata).has(commandId);

export const shouldRefreshWorkbenchExtensionDataTableRenderers = (
  metadata: WorkbenchExtensionMetadata,
  commandId: string,
) => !dataTableRendererQueryCommandIds(metadata).has(commandId);

export const refreshOpenWorkbenchExtensionWebviews = (
  workbench: WorkbenchModuleContributionContext,
  metadata: WorkbenchExtensionMetadata,
) => {
  const activeWidgetId = workbench.layout.getLayout().activeWidgetId;

  for (const view of metadata.views) {
    if (!view.webview || view.surface === "modal") continue;
    const placement = findOpenPlacement(workbench, view.id);
    if (!placement) continue;
    workbench.layout.openWidget(view.id, {
      resource: placement.resource,
      title: text(view.title, placement.title),
    });
  }

  for (const route of metadata.routes) {
    if (!route.webview) continue;
    const placement = findOpenPlacement(workbench, route.id);
    if (!placement) continue;
    workbench.layout.openWidget(route.id, {
      resource: placement.resource,
      title: text(route.label, placement.title),
    });
  }

  restoreActiveWidget(workbench, activeWidgetId);
};

export const refreshWorkbenchExtensionContributions = (
  workbench: WorkbenchModuleContributionContext,
  metadata: WorkbenchExtensionMetadata,
  commandId: string,
) => {
  refreshOpenWorkbenchExtensionWebviews(workbench, metadata);

  if (shouldRefreshWorkbenchExtensionTrees(metadata, commandId)) {
    for (const renderer of metadata.treeRenderers ?? []) workbench.renderers.refresh(renderer.id);
  }

  if (shouldRefreshWorkbenchExtensionDataRenderers(metadata, commandId)) {
    for (const renderer of metadata.dataRenderers ?? []) workbench.renderers.refreshDataRenderer(renderer.id);
  }

  if (shouldRefreshWorkbenchExtensionDataTableRenderers(metadata, commandId)) {
    for (const renderer of metadata.dataTableRenderers ?? []) {
      workbench.renderers.refreshDataTableRenderer(renderer.id);
    }
  }
};
