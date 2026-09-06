import type { WorkbenchExtensionControlsRendererRecord } from "pstdio-api-contracts";
import { controlsQueryResultSchema } from "pstdio-api-contracts";
import { text } from "pstdio-extensions/workbench";
import type { Disposable, ResourceRef } from "../../core";
import type { WorkbenchExtensionCommandContext } from "../host/workbench-extension-command";
import { createExtensionSlot, executeWorkbenchExtensionCommand } from "../host/workbench-extension-command";

const localize = (value: unknown, fallback = "") => text(value as Parameters<typeof text>[0], fallback);
export interface WorkbenchExtensionControlsAdapter {
  /** Supply a fallback resource when the widget placement carries none. */
  resolveResource?: (record: WorkbenchExtensionControlsRendererRecord) => ResourceRef | undefined;
}
const registerControlsRenderer = (
  context: WorkbenchExtensionCommandContext,
  record: WorkbenchExtensionControlsRendererRecord,
  adapter: WorkbenchExtensionControlsAdapter,
) => {
  const slot = createExtensionSlot({
    id: record.id,
    kind: "renderer",
    projectId: context.projectId,
    context: { controlsRendererId: record.id },
  });
  const run = (commandId: string | undefined, params: Record<string, unknown>, resource?: ResourceRef) =>
    commandId
      ? executeWorkbenchExtensionCommand(context, commandId, {
          params: {
            renderer: {
              rendererId: record.id,
              projectId: context.projectId,
              ...(resource ? { resource: resource } : {}),
              invocation: { placement: "visible" },
            },
            ...params,
          },
          resource,
          slot,
          metadata: { controlsRendererId: record.id },
        })
      : Promise.resolve(undefined);
  return context.workbench.views.registerView({
    id: record.id,
    title: localize(record.title, record.id),
    icon: record.icon,
    body: {
      kind: "controls",
      emptyTitle: localize(record.emptyTitle, ""),
      emptyDescription: localize(record.emptyDescription, ""),
      defaultValues: record.defaultValues,
      executeQuery: async (resource) => {
        const value = await run(record.queryHandlerId, {}, resource ?? adapter.resolveResource?.(record));
        const result = controlsQueryResultSchema.safeParse(value);
        if (!result.success) {
          const fields = result.error.issues
            .map((issue) => `body.query.${issue.path.join(".")}: ${issue.message}`)
            .join("; ");
          throw new Error(
            `Extension "${record.extensionId}" view "${record.id}" has invalid controls. Expected serializable control declarations. ${fields}`,
          );
        }
        return result.data;
      },
      updateValue: record.valueChangeHandlerId
        ? ({ controlId, value, values, resource }) =>
            run(record.valueChangeHandlerId, { controlId, value, values }, resource).then(() => undefined)
        : undefined,
      apply: record.applyHandlerId
        ? ({ values, resource }) => run(record.applyHandlerId, { values }, resource).then(() => undefined)
        : undefined,
      reset: record.resetHandlerId
        ? ({ controlIds, resource }) => run(record.resetHandlerId, { controlIds }, resource).then(() => undefined)
        : undefined,
    },
  });
};
// Bridges serializable controls renderer metadata into live workbench controls renderers
// (wiring each query/update/apply/reset command id to command execution), and registers a
// panel widget for every panel that places one.
export const registerWorkbenchExtensionControlsRenderers = (
  context: WorkbenchExtensionCommandContext,
  records: WorkbenchExtensionControlsRendererRecord[],
  adapter: WorkbenchExtensionControlsAdapter = {},
): Disposable => {
  const disposables: Disposable[] = [];
  for (const record of records) disposables.push(registerControlsRenderer(context, record, adapter));
  return {
    dispose() {
      for (let index = disposables.length - 1; index >= 0; index -= 1) disposables[index]?.dispose();
    },
  };
};
