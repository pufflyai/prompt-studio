import type { Status as StatusResponse, Tag as TagResponse } from "@pstdio/sdk/resources";
import type { StatusAction, TicketColumnAction, TicketStatusColor, TicketTag } from "./project-types";

const defaultStatusColor: TicketStatusColor = "gray";
const defaultStatusName = "Unassigned";

const toActions = (status: StatusResponse) => {
  const actions: StatusAction[] = [];
  if (status.can_create) actions.push("create_ticket");
  if (status.can_drag_in) actions.push("drag_in");
  if (status.can_drag_out) actions.push("drag_out");
  if (status.column_actions?.includes("archive_all")) actions.push("archive_all");
  return actions;
};

export const toTicketStatusOption = (status: StatusResponse) => {
  const columnActions: TicketColumnAction[] = status.column_actions?.includes("archive_all") ? ["archive_all"] : [];

  return {
    id: status.id,
    name: status.name,
    color: (status.color || defaultStatusColor) as TicketStatusColor,
    sortOrder: status.sort_order,
    isDefault: status.is_default,
    canDragOut: status.can_drag_out ?? true,
    canDragIn: status.can_drag_in ?? true,
    canCreate: status.can_create ?? status.is_default,
    columnActions,
    actions: toActions(status),
  };
};

export const buildTicketStatusCatalog = (statuses: StatusResponse[]) => {
  const sorted = [...statuses].sort((a, b) => a.sort_order - b.sort_order);
  const options = sorted.map(toTicketStatusOption);
  const defaultStatus = options.find((status) => status.isDefault) ?? options[0];
  const fallbackName = defaultStatus?.name ?? defaultStatusName;
  const fallbackColor = defaultStatus?.color ?? defaultStatusColor;

  return {
    names: options.length ? options.map((status) => status.name) : [fallbackName],
    statusById: new Map(options.map((status) => [status.id, status.name])),
    idByName: new Map(options.map((status) => [status.name, status.id])),
    colorById: new Map(options.map((status) => [status.id, status.color])),
    fallbackName,
    fallbackColor,
    options,
  };
};

export const toTicketTag = (tag: TagResponse): TicketTag => ({
  id: tag.id,
  name: tag.name,
  type: (tag.type ?? "single_select") as TicketTag["type"],
  options: Array.isArray(tag.options)
    ? tag.options.map((option) => ({
        id: option.id,
        name: option.name,
        color: (option.color || defaultStatusColor) as TicketStatusColor,
        sortOrder: option.sort_order,
        icon: option.icon ?? null,
        description: option.description ?? null,
      }))
    : [],
});
