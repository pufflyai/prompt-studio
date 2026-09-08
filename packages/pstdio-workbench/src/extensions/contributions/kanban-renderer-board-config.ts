import type { KanbanRendererBoardColumnConfig as WireBoardColumnConfig } from "@pstdio/sdk/extensions";
import type { WorkbenchExtensionKanbanRendererRecord } from "pstdio-api-contracts";
import { createElement } from "react";
import { WorkbenchIcon } from "../../react";
import type { ReactKanbanRendererContribution as KanbanRendererContribution } from "../../react/renderers/kanban/kanban-presentation";
import type { WorkbenchExtensionCommandContext } from "../host/workbench-extension-command";
import type { Localizer, ResolveStatusOptions } from "./kanban-renderer-contribution-helpers";

type BoardColumnConfig = ReturnType<NonNullable<KanbanRendererContribution["getBoardColumnConfig"]>>;

const createBoardActionIcon = (icon: string | undefined) => {
  const BoardActionIcon = (props: { size?: number | string }) =>
    createElement(WorkbenchIcon, { name: icon ?? "MoreHorizontal", ...props });
  return BoardActionIcon;
};

export const toWorkbenchBoardColumnConfig = (config: WireBoardColumnConfig | undefined, localize: Localizer) =>
  ({
    color: config?.color,
    canDragIn: config?.canDragIn,
    canDragOut: config?.canDragOut,
    canCreate: config?.canCreate,
    actions: config?.actions?.map((action) => ({
      id: action.id,
      label: localize(action.label, action.id),
      icon: createBoardActionIcon(action.icon),
    })),
  }) satisfies BoardColumnConfig;

const statusSetId = (record: WorkbenchExtensionKanbanRendererRecord, ref: Parameters<ResolveStatusOptions>[0]) =>
  `${ref.extensionId ?? record.extensionId}.status.${ref.id}`;

export const createStatusOptionsResolver = (
  context: WorkbenchExtensionCommandContext,
  record: WorkbenchExtensionKanbanRendererRecord,
): ResolveStatusOptions => {
  const sources = new Map<string, ReturnType<ResolveStatusOptions>>();
  return (ref) => {
    const id = statusSetId(record, ref);
    const existing = sources.get(id);
    if (existing) return existing;

    const source = {
      getSnapshot: () =>
        (context.workbench.statuses.getStatuses(id) ?? []).map((status) => ({
          value: status.id,
          label: status.label,
          color: status.color,
          icon: status.icon,
        })),
      subscribe: (listener: () => void) =>
        context.workbench.statuses.store.subscribeSelector((state) => state.values[id], listener),
    };
    sources.set(id, source);
    void context.workbench.statuses.load(id).catch(() => undefined);
    return source;
  };
};

export const statusColorConfig = (
  context: WorkbenchExtensionCommandContext,
  record: WorkbenchExtensionKanbanRendererRecord,
  attributes: WorkbenchExtensionKanbanRendererRecord["attributes"],
  groupingAttributeId: string | undefined,
  groupKey: string,
): WireBoardColumnConfig | undefined => {
  const attribute = attributes?.find((candidate) => candidate.id === groupingAttributeId);
  if (attribute?.type.kind !== "status") return undefined;
  const id = statusSetId(record, attribute.type.statuses);
  const status = context.workbench.statuses.getStatuses(id)?.find((candidate) => candidate.id === groupKey);
  return status ? { color: status.color } : undefined;
};

export const initialColumnGrouping = (record: WorkbenchExtensionKanbanRendererRecord) => {
  if (record.defaultSettings?.columnGrouping) return record.defaultSettings.columnGrouping;
  const statusAttributes = record.attributes?.filter((attribute) => attribute.type.kind === "status") ?? [];
  return statusAttributes.length === 1 ? statusAttributes[0]?.id : undefined;
};
