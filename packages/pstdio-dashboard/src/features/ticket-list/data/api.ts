import type { TicketStatusColor, TicketStatusOption, TicketTag } from "../types";

export const TICKET_STATUS_PALETTE: TicketStatusColor[] = [
  "gray",
  "red",
  "orange",
  "yellow",
  "green",
  "teal",
  "blue",
  "cyan",
  "purple",
  "pink",
];

export type ApiTicketStatus = {
  id: string;
  name: string;
  color: string;
  sort_order: number;
  is_default: boolean;
};

export type ApiTicketTag = {
  id: string;
  name: string;
  color: string;
};

const toTicketStatusColor = (color: string): TicketStatusColor =>
  TICKET_STATUS_PALETTE.includes(color as TicketStatusColor) ? (color as TicketStatusColor) : "gray";

const resolveDefaultColumnActions = (statusName: string) => {
  if (statusName === "done") {
    return ["archive_all"] as const;
  }

  return [];
};

export const toTicketStatusOption = (status: ApiTicketStatus): TicketStatusOption => ({
  id: status.id,
  name: status.name,
  color: toTicketStatusColor(status.color),
  sortOrder: status.sort_order,
  isDefault: status.is_default,
  canDragOut: status.name !== "done",
  canDragIn: true,
  canCreate: status.name !== "done",
  canAttemptOnDrop: status.name === "in_progress",
  columnActions: [...resolveDefaultColumnActions(status.name)],
});

export const toTicketTag = (tag: ApiTicketTag): TicketTag => {
  const timestamp = new Date(0).toISOString();

  return {
    id: tag.id,
    name: tag.name,
    color: toTicketStatusColor(tag.color),
    createdAt: timestamp,
    updatedAt: timestamp,
  };
};

export const buildTicketStatusCatalog = (statuses: ApiTicketStatus[]) => {
  const options = statuses
    .map(toTicketStatusOption)
    .sort((left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name));
  const names = options.map((status) => status.name);

  return { names, options };
};
