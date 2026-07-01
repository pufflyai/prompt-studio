import type { WorkbenchExtensionControlsRendererRecord, WorkbenchExtensionMetadata } from "@pstdio/sdk/api";
import { text } from "pstdio-extensions/workbench";
import type { ControlsQueryResult, Disposable, ResourceRef } from "../../core";
import type { WorkbenchExtensionCommandContext } from "../host/workbench-extension-command";
import { executeWorkbenchExtensionCommand } from "../host/workbench-extension-command";
import { resolveWorkbenchViewArea } from "../shared/workbench-targets";

type ControlsViewRecord = WorkbenchExtensionMetadata["views"][number];

const localize = (value: unknown, fallback = "") => text(value as Parameters<typeof text>[0], fallback);

const isQueryResult = (value: unknown): value is ControlsQueryResult =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

export interface WorkbenchExtensionControlsAdapter {
  /** Supply a fallback resource when the widget placement carries none. */
  resolveResource?: (record: WorkbenchExtensionControlsRendererRecord) => ResourceRef | undefined;
}

const registerControlsRenderer = (
  context: WorkbenchExtensionCommandContext,
  record: WorkbenchExtensionControlsRendererRecord,
  adapter: WorkbenchExtensionControlsAdapter,
) => {
  const run = (commandId: string | undefined, params: Record<string, unknown>, resource?: ResourceRef) =>
    commandId ? executeWorkbenchExtensionCommand(context, commandId, { params, resource }) : Promise.resolve(undefined);

  return context.workbench.renderers.registerControlsRenderer({
    id: record.id,
    title: localize(record.title, record.id),
    emptyTitle: localize(record.emptyTitle, ""),
    emptyDescription: localize(record.emptyDescription, ""),
    defaultValues: record.defaultValues,
    executeQuery: async (resource) => {
      const value = await run(record.queryCommandId, {}, resource ?? adapter.resolveResource?.(record));
      return isQueryResult(value) ? value : {};
    },
    updateValue: record.updateValueCommandId
      ? ({ controlId, value, values, resource }) =>
          run(record.updateValueCommandId, { controlId, value, values }, resource).then(() => undefined)
      : undefined,
    apply: record.applyCommandId
      ? ({ values, resource }) => run(record.applyCommandId, { values }, resource).then(() => undefined)
      : undefined,
    reset: record.resetCommandId
      ? ({ controlIds, resource }) => run(record.resetCommandId, { controlIds }, resource).then(() => undefined)
      : undefined,
  });
};

// A view that references a controls renderer places it into a panel — the widget is
// keyed by the view id and rendered by the referenced controls renderer, mirroring
// tree/file renderer view widgets.
const registerControlsViewWidget = (context: WorkbenchExtensionCommandContext, view: ControlsViewRecord) => {
  if (!view.controlsRendererId) return undefined;
  return context.workbench.layout.registerWidget({
    id: view.id,
    title: text(view.title, view.id),
    area: view.surface === "modal" ? "overlay" : resolveWorkbenchViewArea(view.target),
    rendererId: view.controlsRendererId,
    singleton: true,
    resourceKinds: view.resourceKind ? [view.resourceKind] : undefined,
  });
};

// Bridges serializable controls renderer metadata into live workbench controls renderers
// (wiring each query/update/apply/reset command id to command execution), and registers a
// panel widget for every view that places one.
export const registerWorkbenchExtensionControlsRenderers = (
  context: WorkbenchExtensionCommandContext,
  records: WorkbenchExtensionControlsRendererRecord[],
  views: ControlsViewRecord[],
  adapter: WorkbenchExtensionControlsAdapter = {},
): Disposable => {
  const disposables: Disposable[] = [];

  for (const record of records) disposables.push(registerControlsRenderer(context, record, adapter));
  for (const view of views) {
    const disposable = registerControlsViewWidget(context, view);
    if (disposable) disposables.push(disposable);
  }

  return {
    dispose() {
      for (let index = disposables.length - 1; index >= 0; index -= 1) disposables[index]?.dispose();
    },
  };
};
