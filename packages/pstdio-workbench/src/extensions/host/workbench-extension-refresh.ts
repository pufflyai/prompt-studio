import type { WorkbenchExtensionMetadata } from "@pstdio/sdk/api";
import type { Disposable, FileRendererRefreshEnvelope, WorkbenchModuleContext } from "../../core";

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
  workbench.views.refreshView(target.id, target.kind === "file" ? envelope : undefined);
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

export const refreshOpenWorkbenchExtensionWebviews = (
  workbench: WorkbenchModuleContext,
  metadata: WorkbenchExtensionMetadata,
) => {
  for (const view of metadata.views) {
    if (view.body.kind !== "webview") continue;
    if (workbench.views.getView(view.id)) workbench.views.refreshView(view.id);
  }
};
