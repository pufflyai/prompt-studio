import type { WorkbenchExtensionControlsRendererRecord } from "@pstdio/sdk/api";
import { text } from "pstdio-extensions/workbench";
import type { ControlsQueryResult, Disposable, ResourceRef, WorkbenchArea } from "../../core";
import type { WorkbenchExtensionCommandContext } from "../host/workbench-extension-command";
import { executeWorkbenchExtensionCommand } from "../host/workbench-extension-command";

const localize = (value: unknown, fallback = "") => text(value as Parameters<typeof text>[0], fallback);

const isQueryResult = (value: unknown): value is ControlsQueryResult =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const resolveArea = (area: string | undefined): WorkbenchArea =>
  area === "secondary" || area === "overlay" ? area : "main-right";

export interface WorkbenchExtensionControlsAdapter {
  /** Supply a fallback resource when the widget placement carries none. */
  resolveResource?: (record: WorkbenchExtensionControlsRendererRecord) => ResourceRef | undefined;
}

// Bridges serializable controls renderer metadata into live workbench controls
// renderers by wiring each query/update/apply/reset command id to command execution.
export const registerWorkbenchExtensionControlsRenderers = (
  context: WorkbenchExtensionCommandContext,
  records: WorkbenchExtensionControlsRendererRecord[],
  adapter: WorkbenchExtensionControlsAdapter = {},
): Disposable => {
  const disposables: Disposable[] = [];

  for (const record of records) {
    const run = (commandId: string | undefined, params: Record<string, unknown>, resource?: ResourceRef) =>
      commandId
        ? executeWorkbenchExtensionCommand(context, commandId, { params, resource })
        : Promise.resolve(undefined);

    disposables.push(
      context.workbench.renderers.registerControlsRenderer({
        id: record.id,
        title: localize(record.title, record.id),
        resourceKind: record.resourceKind,
        emptyTitle: localize(record.emptyTitle, ""),
        emptyDescription: localize(record.emptyDescription, ""),
        layout: record.layout,
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
      }),
    );

    disposables.push(
      context.workbench.layout.registerWidget({
        id: record.id,
        title: localize(record.title, record.id),
        area: resolveArea(record.layout?.area),
        rendererId: record.id,
        singleton: true,
        resourceKinds: record.resourceKind ? [record.resourceKind] : undefined,
        areaSize: record.layout
          ? { defaultPx: record.layout.defaultPx, minPx: record.layout.minPx, maxPx: record.layout.maxPx }
          : undefined,
      }),
    );
  }

  return {
    dispose() {
      for (let index = disposables.length - 1; index >= 0; index -= 1) disposables[index]?.dispose();
    },
  };
};
