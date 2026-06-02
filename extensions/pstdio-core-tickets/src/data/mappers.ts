import type {
  DataRendererAttributeDescriptor,
  DataRendererBoardColumnConfig,
  DataRendererEnumOption,
  DataRendererRow,
} from "@pstdio/sdk/extensions";
import type { StoredStatus, StoredTag, StoredTicket } from "./types";

export const TICKET_RESOURCE_KIND = "ticket";

const COLUMN_ACTION_LABELS: Record<string, string> = {
  archive_all: "Archive all",
};

const bySortOrder = <T extends { sortOrder: number }>(left: T, right: T) => left.sortOrder - right.sortOrder;

export const ticketDisplayTitle = (ticket: StoredTicket) =>
  ticket.title ? `${ticket.shorthand} ${ticket.title}` : ticket.shorthand;

const ticketTagValues = (ticket: StoredTicket, tags: StoredTag[]) =>
  Object.fromEntries(
    tags.map((tag) => {
      const optionIds = new Set(tag.options.map((option) => option.id));
      const selected = (ticket.tagIds ?? []).filter((id) => optionIds.has(id));
      return [tag.id, tag.type === "single_select" ? (selected[0] ?? "") : selected];
    }),
  );

export const ticketToRow = (ticket: StoredTicket, projectId: string, tags: StoredTag[] = []): DataRendererRow => ({
  id: ticket.id,
  title: ticketDisplayTitle(ticket),
  resource: {
    type: TICKET_RESOURCE_KIND,
    id: ticket.id,
    projectId,
    label: ticketDisplayTitle(ticket),
  },
  attributes: {
    status: ticket.statusId ?? "",
    updated: ticket.updatedAt,
    shorthand: ticket.shorthand,
    ...ticketTagValues(ticket, tags),
  },
});

const statusToOption = (status: StoredStatus): DataRendererEnumOption => ({
  value: status.id,
  label: status.name,
  color: status.color,
});

const tagToAttribute = (tag: StoredTag): DataRendererAttributeDescriptor => ({
  id: tag.id,
  label: tag.name,
  type: {
    kind: tag.type === "multi_select" ? "enum-multi" : "enum",
    options: [...tag.options].sort(bySortOrder).map((option) => ({
      value: option.id,
      label: option.name,
      color: option.color,
    })),
  },
  filterable: true,
  displayable: true,
  editable: true,
  groupable: tag.type === "single_select",
});

export const buildTicketAttributes = (
  statuses: StoredStatus[],
  tags: StoredTag[] = [],
): DataRendererAttributeDescriptor[] => [
  {
    id: "status",
    label: "Status",
    type: { kind: "enum", options: [...statuses].sort(bySortOrder).map(statusToOption) },
    groupable: true,
    filterable: true,
    displayable: true,
    editable: true,
  },
  { id: "updated", label: "Updated", type: { kind: "date" }, sortable: true, displayable: true },
  { id: "shorthand", label: "ID", type: { kind: "string" }, displayable: true },
  ...[...tags].sort(bySortOrder).map(tagToAttribute),
];

export const statusToColumnConfig = (status: StoredStatus): DataRendererBoardColumnConfig => ({
  color: status.color,
  canDragIn: status.canDragIn,
  canDragOut: status.canDragOut,
  canCreate: status.canCreate,
  actions: status.columnActions.map((id) => ({ id, label: COLUMN_ACTION_LABELS[id] ?? id })),
});
