import type { WorkbenchExtensionMetadata } from "@pstdio/sdk/api";
import { text } from "pstdio-extensions/workbench";
import type { WorkbenchModuleContext, WorkbenchPanelInstance } from "../../core";

const treeQueryCommandIds = (metadata: WorkbenchExtensionMetadata) =>
  new Set(
    (metadata.treeRenderers ?? []).flatMap((renderer) =>
      [renderer.bodyCommandId, renderer.childrenCommandId, renderer.footerCommandId].filter((commandId) => commandId),
    ),
  );

const kanbanRendererQueryCommandIds = (metadata: WorkbenchExtensionMetadata) =>
  new Set((metadata.kanbanRenderers ?? []).map((renderer) => renderer.queryCommandId));

const dataTableRendererQueryCommandIds = (metadata: WorkbenchExtensionMetadata) =>
  new Set((metadata.dataTableRenderers ?? []).map((renderer) => renderer.queryCommandId));

const findOpenPlacement = (workbench: WorkbenchModuleContext, panelId: string): WorkbenchPanelInstance | undefined => {
  return workbench.layout.listPanelInstances().find((candidate) => candidate.panelId === panelId);
};

const restoreActiveWidget = (workbench: WorkbenchModuleContext, panelId: string | undefined) => {
  if (!panelId) return;
  try {
    workbench.layout.activatePanel(panelId);
  } catch {
    // The refreshed widget may have been closed by the command.
  }
};

export const shouldRefreshWorkbenchExtensionTrees = (metadata: WorkbenchExtensionMetadata, commandId: string) =>
  !treeQueryCommandIds(metadata).has(commandId);

export const shouldRefreshWorkbenchExtensionKanbanRenderers = (
  metadata: WorkbenchExtensionMetadata,
  commandId: string,
) => !kanbanRendererQueryCommandIds(metadata).has(commandId);

export const shouldRefreshWorkbenchExtensionDataTableRenderers = (
  metadata: WorkbenchExtensionMetadata,
  commandId: string,
) => !dataTableRendererQueryCommandIds(metadata).has(commandId);

export const refreshOpenWorkbenchExtensionWebviews = (
  workbench: WorkbenchModuleContext,
  metadata: WorkbenchExtensionMetadata,
) => {
  const activeWidgetId = workbench.layout.getLayout().activeWidgetId;

  for (const panel of metadata.panels) {
    if (!panel.webview || panel.region === "overlay") continue;
    const placement = findOpenPlacement(workbench, panel.id);
    if (!placement) continue;
    workbench.layout.openPanel(panel.id, {
      resource: placement.resource,
      title: text(panel.title, placement.title),
    });
  }

  for (const route of metadata.routes) {
    if (!route.webview) continue;
    const placement = findOpenPlacement(workbench, route.id);
    if (!placement) continue;
    workbench.layout.openPanel(route.id, {
      resource: placement.resource,
      title: text(route.label, placement.title),
    });
  }

  restoreActiveWidget(workbench, activeWidgetId);
};

export const refreshWorkbenchExtensionContributions = (
  workbench: WorkbenchModuleContext,
  metadata: WorkbenchExtensionMetadata,
  commandId: string,
) => {
  refreshOpenWorkbenchExtensionWebviews(workbench, metadata);

  if (shouldRefreshWorkbenchExtensionTrees(metadata, commandId)) {
    for (const renderer of metadata.treeRenderers ?? []) workbench.renderers.refresh(renderer.id);
  }

  if (shouldRefreshWorkbenchExtensionKanbanRenderers(metadata, commandId)) {
    for (const renderer of metadata.kanbanRenderers ?? []) workbench.renderers.refreshKanbanRenderer(renderer.id);
  }

  if (shouldRefreshWorkbenchExtensionDataTableRenderers(metadata, commandId)) {
    for (const renderer of metadata.dataTableRenderers ?? []) {
      workbench.renderers.refreshDataTableRenderer(renderer.id);
    }
  }
};
