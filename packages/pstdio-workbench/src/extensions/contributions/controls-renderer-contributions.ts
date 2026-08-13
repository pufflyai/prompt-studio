import type { WorkbenchExtensionControlsRendererRecord, WorkbenchExtensionMetadata } from "@pstdio/sdk/api";
import { text } from "pstdio-extensions/workbench";
import type { ControlsQueryResult, Disposable, ResourceRef } from "../../core";
import type { WorkbenchExtensionCommandContext } from "../host/workbench-extension-command";
import { executeWorkbenchExtensionCommand } from "../host/workbench-extension-command";
import {
  panelMenuDeclarationOffsets,
  registerWorkbenchExtensionPanel,
  toWorkbenchExtensionPlacementMetadata,
  toWorkbenchPanelEligibility,
  toWorkbenchPanelMenus,
} from "./panel-contributions";

type ControlsViewRecord = WorkbenchExtensionMetadata["panels"][number];

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

// A panel that references a controls renderer places it into a panel — the widget is
// keyed by the panel id and rendered by the referenced controls renderer, mirroring
// tree/file renderer panel widgets.
const registerControlsViewWidget = (
  context: WorkbenchExtensionCommandContext,
  panel: ControlsViewRecord,
  index: number,
  menuDeclarationOffset: number,
) => {
  if (!panel.controlsRendererId) return undefined;
  return registerWorkbenchExtensionPanel({
    workbench: context.workbench,
    contribution: {
      id: panel.id,
      title: text(panel.title, panel.id),
      icon: panel.icon,
      region: panel.region,
      closable: panel.closable,
      rendererId: panel.controlsRendererId,
      singleton: true,
      resourceKinds: panel.resourceKind ? [panel.resourceKind] : undefined,
      eligibleLocations: toWorkbenchPanelEligibility(panel.eligibleLocations),
      panelMenus: toWorkbenchPanelMenus(panel.panelMenus, menuDeclarationOffset),
      ...toWorkbenchExtensionPlacementMetadata({ placement: panel.placement, declarationIndex: index }),
    },
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
): Disposable => {
  const disposables: Disposable[] = [];

  for (const record of records) disposables.push(registerControlsRenderer(context, record, adapter));
  const menuOffsets = panelMenuDeclarationOffsets(panels);
  panels.forEach((panel, index) => {
    const disposable = registerControlsViewWidget(context, panel, index, menuOffsets[index]!);
    if (disposable) disposables.push(disposable);
  });

  return {
    dispose() {
      for (let index = disposables.length - 1; index >= 0; index -= 1) disposables[index]?.dispose();
    },
  };
};
