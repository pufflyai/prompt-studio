import type { WorkbenchExtensionMetadata } from "@pstdio/sdk/api";
import { text } from "pstdio-extensions/workbench";
import type { WorkbenchModuleContext, WorkbenchPanelInstance } from "../../core";

const treeQueryHandlerIds = (metadata: WorkbenchExtensionMetadata) =>
  new Set(
    (metadata.treeRenderers ?? []).flatMap((renderer) =>
      [renderer.bodyHandlerId, renderer.childrenHandlerId, renderer.footerHandlerId].filter((handlerId) => handlerId),
    ),
  );

const kanbanRendererQueryHandlerIds = (metadata: WorkbenchExtensionMetadata) =>
  new Set((metadata.kanbanRenderers ?? []).map((renderer) => renderer.queryHandlerId));

const dataTableRendererQueryHandlerIds = (metadata: WorkbenchExtensionMetadata) =>
  new Set((metadata.dataTableRenderers ?? []).map((renderer) => renderer.queryHandlerId));

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
  !treeQueryHandlerIds(metadata).has(commandId);

export const shouldRefreshWorkbenchExtensionKanbanRenderers = (
  metadata: WorkbenchExtensionMetadata,
  commandId: string,
) => !kanbanRendererQueryHandlerIds(metadata).has(commandId);

export const shouldRefreshWorkbenchExtensionDataTableRenderers = (
  metadata: WorkbenchExtensionMetadata,
  commandId: string,
) => !dataTableRendererQueryHandlerIds(metadata).has(commandId);

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
      strategy: { kind: "replace-panel", instanceId: placement.instanceId },
    });
  }

  for (const route of metadata.routes) {
    if (!route.webview) continue;
    const placement = findOpenPlacement(workbench, route.id);
    if (!placement) continue;
    workbench.layout.openPanel(route.id, {
      resource: placement.resource,
      title: text(route.label, placement.title),
      strategy: { kind: "replace-panel", instanceId: placement.instanceId },
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
