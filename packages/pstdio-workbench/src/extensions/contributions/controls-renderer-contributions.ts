import type { WorkbenchExtensionControlsRendererRecord } from "pstdio-api-contracts";
import { text } from "pstdio-extensions/workbench";
import type { ControlsQueryResult, Disposable, ResourceRef } from "../../core";
import type { InternalWorkbenchExtensionMetadata as WorkbenchExtensionMetadata } from "../host/internal-workbench-extension-metadata";
import type { WorkbenchExtensionCommandContext } from "../host/workbench-extension-command";
import {
  createExtensionSlot,
  executeWorkbenchExtensionCommand,
  toExtensionCommandResource,
} from "../host/workbench-extension-command";
import {
  panelMenuDeclarationOffsets,
  panelRendererId,
  registerWorkbenchExtensionPanel,
  resolveWorkbenchExtensionViewInput,
  toWorkbenchCompositionPanelContribution,
  type WorkbenchExtensionViewInputResolver,
} from "./panel-contributions";

type ControlsViewRecord = WorkbenchExtensionMetadata["panels"][number];

const localize = (value: unknown, fallback = "") => text(value as Parameters<typeof text>[0], fallback);

const isQueryResult = (value: unknown): value is ControlsQueryResult =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

export interface WorkbenchExtensionControlsAdapter {
  /** Supply a fallback resource when the widget placement carries none. */
  resolveResource?: (record: WorkbenchExtensionControlsRendererRecord) => ResourceRef | undefined;
  resolveViewInput?: WorkbenchExtensionViewInputResolver;
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
              ...(resource ? { resource: toExtensionCommandResource(resource) } : {}),
              invocation: { placement: "visible" },
            },
            ...params,
          },
          resource,
          slot,
          metadata: { controlsRendererId: record.id },
        })
      : Promise.resolve(undefined);

  return context.workbench.renderers.registerControlsRenderer({
    id: record.id,
    title: localize(record.title, record.id),
    emptyTitle: localize(record.emptyTitle, ""),
    emptyDescription: localize(record.emptyDescription, ""),
    defaultValues: record.defaultValues,
    executeQuery: async (resource) => {
      const value = await run(record.queryHandlerId, {}, resource ?? adapter.resolveResource?.(record));
      return isQueryResult(value) ? value : {};
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
  });
};

// A panel that references a controls renderer places it into a panel — the widget is
// keyed by the panel id and rendered by the referenced controls renderer, mirroring
// tree/file renderer panel widgets.
const registerControlsViewWidget = (
  context: WorkbenchExtensionCommandContext,
  panel: ControlsViewRecord,
  index: number,
  menuDeclarationOffset: number,
  resourcePanels: WorkbenchExtensionMetadata["resourcePanels"],
  adapter: WorkbenchExtensionControlsAdapter,
) => {
  const rendererId = panelRendererId(panel, "controls");
  if (!rendererId) return undefined;
  return registerWorkbenchExtensionPanel({
    workbench: context.workbench,
    path: panel.path,
    aliases: panel.aliases,
    resolveInput: resolveWorkbenchExtensionViewInput(adapter.resolveViewInput, panel),
    contribution: toWorkbenchCompositionPanelContribution({
      panel,
      rendererId,
      declarationIndex: index,
      menuDeclarationOffset: menuDeclarationOffset,
      resourcePanels,
    }),
  });
};

// Bridges serializable controls renderer metadata into live workbench controls renderers
// (wiring each query/update/apply/reset command id to command execution), and registers a
// panel widget for every panel that places one.
export const registerWorkbenchExtensionControlsRenderers = (
  context: WorkbenchExtensionCommandContext,
  records: WorkbenchExtensionControlsRendererRecord[],
  panels: ControlsViewRecord[],
  adapter: WorkbenchExtensionControlsAdapter = {},
  resourcePanels: WorkbenchExtensionMetadata["resourcePanels"] = [],
): Disposable => {
  const disposables: Disposable[] = [];

  for (const record of records) disposables.push(registerControlsRenderer(context, record, adapter));
  const menuOffsets = panelMenuDeclarationOffsets(panels);
  panels.forEach((panel, index) => {
    const disposable = registerControlsViewWidget(context, panel, index, menuOffsets[index]!, resourcePanels, adapter);
    if (disposable) disposables.push(disposable);
  });

  return {
    dispose() {
      for (let index = disposables.length - 1; index >= 0; index -= 1) disposables[index]?.dispose();
    },
  };
};
