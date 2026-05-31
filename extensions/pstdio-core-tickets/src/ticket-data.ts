import type { AttributeDescriptor, BoardColumnConfig, DataRendererRow, DataRendererSettings } from "@pstdio/ui";

type TicketColumnAction = "archive_all";

export interface TicketRecord {
  id: string;
  shorthand: string;
  display_title?: string | null;
  displayTitle?: string | null;
  status_name?: string | null;
  status?: string | null;
  tag_ids?: string[];
  tag_names?: string[];
  tagNames?: string[];
  updated_at?: string;
}

export interface TicketStatusDefinition {
  id: string;
  name: string;
  color: string;
  sortOrder: number;
  isDefault: boolean;
  canCreate: boolean;
  canDragIn: boolean;
  canDragOut: boolean;
  columnActions: string[];
}

export interface TicketDataRow extends DataRendererRow {
  resource: {
    type: "ticket";
    id: string;
    label: string;
    metadata: {
      shorthand: string;
      title?: string | null;
    };
  };
  attributes: {
    shorthand: string;
    status: string;
    tags: string[];
    updated: string;
  };
}

export interface TicketBoardColumnConfig extends Omit<BoardColumnConfig, "actions"> {
  actionIds: TicketColumnAction[];
}

const unassignedStatus = "Unassigned";

const ticketTitle = (ticket: TicketRecord) => ticket.display_title ?? ticket.displayTitle ?? "";

const ticketStatus = (ticket: TicketRecord) => ticket.status_name ?? ticket.status ?? unassignedStatus;

const ticketTags = (ticket: TicketRecord) => ticket.tag_names ?? ticket.tagNames ?? [];

const ticketUpdatedAt = (ticket: TicketRecord) => ticket.updated_at ?? "";

export const ticketDefaultSettings = {
  viewMode: "board",
  columnGrouping: "status",
  rowGrouping: "none",
  ordering: { attributeId: "updated", direction: "desc" },
  displayProperties: ["shorthand", "tags", "updated"],
} satisfies Partial<DataRendererSettings>;

export const createTicketAttributes = (statuses: TicketStatusDefinition[]): AttributeDescriptor[] => {
  const statusOptions = statuses
    .slice()
    .sort((left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name))
    .map((status) => ({
      value: status.name,
      label: status.name,
      color: status.color,
    }));

  return [
    {
      id: "status",
      label: "Status",
      type: { kind: "enum", options: statusOptions },
      filterable: true,
      groupable: true,
      sortable: true,
      displayable: true,
      editable: true,
    },
    {
      id: "shorthand",
      label: "Ticket",
      type: { kind: "string" },
      filterable: true,
      sortable: true,
      displayable: true,
    },
    {
      id: "tags",
      label: "Tags",
      type: { kind: "enum-multi", options: [] },
      filterable: true,
      displayable: true,
    },
    {
      id: "updated",
      label: "Updated",
      type: { kind: "date" },
      sortable: true,
      displayable: true,
    },
  ];
};

export const createTicketRows = (tickets: TicketRecord[]): TicketDataRow[] =>
  tickets.map((ticket) => {
    const title = ticketTitle(ticket);
    const label = [ticket.shorthand, title].filter(Boolean).join(" ");

    return {
      id: ticket.id,
      title: label,
      resource: {
        type: "ticket",
        id: ticket.id,
        label: ticket.shorthand,
        metadata: { shorthand: ticket.shorthand, title },
      },
      attributes: {
        shorthand: ticket.shorthand,
        status: ticketStatus(ticket),
        tags: ticketTags(ticket),
        updated: ticketUpdatedAt(ticket),
      },
    };
  });

export const resolveTicketBoardColumnConfig = (
  statuses: TicketStatusDefinition[],
  statusName: string,
): TicketBoardColumnConfig => {
  const status = statuses.find((candidate) => candidate.name === statusName);
  return {
    color: status?.color ?? "gray",
    canCreate: status?.canCreate ?? false,
    canDragIn: status?.canDragIn ?? false,
    canDragOut: status?.canDragOut ?? false,
    actionIds: status?.columnActions.filter((action): action is TicketColumnAction => action === "archive_all") ?? [],
  };
};
