import type { WorkbenchExtensionMetadata } from "@pstdio/sdk/api";
import { text } from "pstdio-extensions/workbench";
import type { Disposable, WorkbenchModuleContext, WorkbenchPanelInstance } from "../../core";

export type WorkbenchExtensionRendererKind = "tree" | "file" | "controls" | "dataTable" | "kanban";

interface RendererRefreshTarget {
  id: string;
  kind: WorkbenchExtensionRendererKind;
}

export interface RegisterWorkbenchExtensionRendererRefreshEventsInput {
  metadata: WorkbenchExtensionMetadata;
  subscribe: (listener: (eventId: string) => void) => Disposable;
  workbench: WorkbenchModuleContext;
}

export const refreshWorkbenchExtensionRenderer = (workbench: WorkbenchModuleContext, target: RendererRefreshTarget) => {
  if (target.kind === "tree") workbench.renderers.refresh(target.id);
  if (target.kind === "file") workbench.renderers.refreshFileRenderer(target.id);
  if (target.kind === "controls") workbench.renderers.refreshControlsRenderer(target.id);
  if (target.kind === "dataTable") workbench.renderers.refreshDataTableRenderer(target.id);
  if (target.kind === "kanban") workbench.renderers.refreshKanbanRenderer(target.id);
};

const rendererRefreshTargets = (metadata: WorkbenchExtensionMetadata) => {
  const targets = new Map<string, RendererRefreshTarget[]>();
  const add = (kind: WorkbenchExtensionRendererKind, renderer: { id: string; refreshEventIds?: string[] }) => {
    for (const eventId of new Set(renderer.refreshEventIds ?? [])) {
      const eventTargets = targets.get(eventId) ?? [];
      if (!eventTargets.some((target) => target.kind === kind && target.id === renderer.id)) {
        eventTargets.push({ id: renderer.id, kind });
      }
      targets.set(eventId, eventTargets);
    }
  };

  for (const renderer of metadata.treeRenderers ?? []) add("tree", renderer);
  for (const renderer of metadata.fileRenderers ?? []) add("file", renderer);
  for (const renderer of metadata.controlsRenderers ?? []) add("controls", renderer);
  for (const renderer of metadata.dataTableRenderers ?? []) add("dataTable", renderer);
  for (const renderer of metadata.kanbanRenderers ?? []) add("kanban", renderer);
  return targets;
};

export const registerWorkbenchExtensionRendererRefreshEvents = (
  input: RegisterWorkbenchExtensionRendererRefreshEventsInput,
) => {
  const targets = rendererRefreshTargets(input.metadata);
  return input.subscribe((eventId) => {
    for (const target of targets.get(eventId) ?? []) refreshWorkbenchExtensionRenderer(input.workbench, target);
  });
};

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
