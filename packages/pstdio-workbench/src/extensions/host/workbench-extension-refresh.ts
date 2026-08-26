import type { WorkbenchExtensionMetadata } from "@pstdio/sdk/api";
import { text } from "pstdio-extensions/workbench";
import type {
  Disposable,
  FileRendererRefreshEnvelope,
  WorkbenchModuleContext,
  WorkbenchPanelInstance,
} from "../../core";

export type WorkbenchExtensionRendererKind = "tree" | "file" | "controls" | "dataTable" | "kanban";

interface RendererRefreshTarget {
  id: string;
  kind: WorkbenchExtensionRendererKind;
}

export interface WorkbenchExtensionRefreshEvent extends FileRendererRefreshEnvelope {
  id: string;
}

export interface RegisterWorkbenchExtensionRendererRefreshEventsInput {
  metadata: WorkbenchExtensionMetadata;
  subscribe: (listener: (event: WorkbenchExtensionRefreshEvent) => void) => Disposable;
  workbench: WorkbenchModuleContext;
}

export const refreshWorkbenchExtensionRenderer = (
  workbench: WorkbenchModuleContext,
  target: RendererRefreshTarget,
  envelope: FileRendererRefreshEnvelope = {},
) => {
  if (target.kind === "tree") workbench.renderers.refresh(target.id);
  if (target.kind === "file") workbench.renderers.refreshFileRenderer(target.id, envelope);
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

  for (const view of metadata.views) {
    if (view.body.kind === "webview") continue;
    add(view.body.kind, { id: view.id, refreshEventIds: view.body.refreshEventIds });
  }
  return targets;
};

export const registerWorkbenchExtensionRendererRefreshEvents = (
  input: RegisterWorkbenchExtensionRendererRefreshEventsInput,
) => {
  const targets = rendererRefreshTargets(input.metadata);
  return input.subscribe((event) => {
    const { id, ...envelope } = event;
    for (const target of targets.get(id) ?? []) refreshWorkbenchExtensionRenderer(input.workbench, target, envelope);
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

  for (const view of metadata.views) {
    if (view.body.kind !== "webview") continue;
    const placement = findOpenPlacement(workbench, view.id);
    if (!placement) continue;
    workbench.layout.openPanel(view.id, {
      resource: placement.resource,
      title: text(view.title, placement.title),
      strategy: { kind: "replace-panel", instanceId: placement.instanceId },
    });
  }

  restoreActiveWidget(workbench, activeWidgetId);
};
