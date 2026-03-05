export type TicketStatus = string;

export type TicketStatusColor =
  | "gray"
  | "red"
  | "orange"
  | "yellow"
  | "green"
  | "teal"
  | "blue"
  | "cyan"
  | "purple"
  | "pink";

export type TicketColumnAction = "archive_all";

export interface TicketStatusOption {
  id: string;
  name: TicketStatus;
  color: TicketStatusColor;
  sortOrder: number;
  isDefault: boolean;
  canDragOut: boolean;
  canDragIn: boolean;
  canCreate: boolean;
  canAttemptOnDrop: boolean;
  columnActions: TicketColumnAction[];
}

export interface TicketTag {
  id: string;
  name: string;
  color: TicketStatusColor;
  createdAt: string;
  updatedAt: string;
}
