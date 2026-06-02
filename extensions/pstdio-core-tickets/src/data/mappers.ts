import type {
  DataRendererAttributeDescriptor,
  DataRendererBoardColumnConfig,
  DataRendererEnumOption,
} from "@pstdio/sdk/extensions";
import { bySortOrder } from "./sort";
import type { StoredStatus, StoredTag, StoredTicket } from "./types";

export const TICKET_RESOURCE_KIND = "ticket";

const COLUMN_ACTION_LABELS: Record<string, string> = {
  archive_all: "Archive all",
};

export const ticketDisplayTitle = (ticket: StoredTicket) =>
  ticket.title ? `${ticket.shorthand} ${ticket.title}` : ticket.shorthand;

type TagOptionsLookup = Array<{ tag: StoredTag; optionIds: Set<string> }>;

const createTagOptionsLookup = (tags: StoredTag[]) =>
  tags.map((tag) => ({
    tag,
    optionIds: new Set(tag.options.map((option) => option.id)),
  }));

const ticketTagValues = (ticket: StoredTicket, tagOptions: TagOptionsLookup) =>
  Object.fromEntries(
    tagOptions.map(({ optionIds, tag }) => {
      const selected = (ticket.tagIds ?? []).filter((id) => optionIds.has(id));
      return [tag.id, tag.type === "single_select" ? (selected[0] ?? "") : selected];
    }),
  );

const ticketToRowWithTags = (ticket: StoredTicket, projectId: string, tagOptions: TagOptionsLookup) => ({
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
    ...ticketTagValues(ticket, tagOptions),
  },
});

export const ticketToRow = (ticket: StoredTicket, projectId: string, tags: StoredTag[] = []) =>
  ticketToRowWithTags(ticket, projectId, createTagOptionsLookup(tags));

export const createTicketRowMapper = (projectId: string, tags: StoredTag[] = []) => {
  const tagOptions = createTagOptionsLookup(tags);
  return (ticket: StoredTicket) => ticketToRowWithTags(ticket, projectId, tagOptions);
};

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
