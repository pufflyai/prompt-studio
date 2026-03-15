import type { SessionStatus } from "@/features/sessions/types";

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
  columnActions: TicketColumnAction[];
}

export interface TicketAttempt {
  id: string;
  label: string;
  status: "active" | "merged" | "rejected";
  sessionStatus: SessionStatus | null;
  shorthand: string;
  sessionId: string;
  updatedAt: string;
  worktreePath: string | null;
}

export interface TicketSubTicket {
  id: string;
  shorthand: string;
  title: string;
  statusId: string | null;
}

export interface Ticket {
  id: string;
  shorthand: string;
  title: string;
  content: string;
  tagIds: string[];
  complexity?: "low" | "medium" | "high" | null;
  blockedReason?: string | null;
  dependsOn?: string | null;
  parentId?: string | null;
  status: TicketStatus;
  statusColor?: TicketStatusColor;
  assignee?: string | null;
  updatedAt: string;
  archived?: boolean;
  draft?: boolean;
  attempts?: TicketAttempt[];
  subTickets?: TicketSubTicket[];
}

export interface TicketTag {
  id: string;
  name: string;
  color: TicketStatusColor;
}

export interface TicketFilePreview {
  id: string;
  file_name: string;
  file_kind: string;
  mime_type: string | null;
  size_bytes: number;
  created_at: string;
}

export type ViewMode = "board" | "list";

export type GroupingField = "status" | "complexity" | "assignee" | "none";

export type OrderingField = "manual" | "updated" | "title" | "complexity" | "shorthand";

export type DisplayProperty = "parentId" | "status" | "complexity" | "assignee" | "tags" | "updatedAt";

export interface DisplaySettings {
  viewMode: ViewMode;
  grouping: GroupingField;
  ordering: OrderingField;
  displayProperties: DisplayProperty[];
}

export const DEFAULT_DISPLAY_SETTINGS: DisplaySettings = {
  viewMode: "board",
  grouping: "status",
  ordering: "manual",
  displayProperties: ["complexity"],
};

export interface TicketGroup {
  id: string;
  label: string;
  color?: TicketStatusColor;
  tickets: Ticket[];
  canDragIn: boolean;
  canDragOut: boolean;
  canCreate: boolean;
  columnActions: TicketColumnAction[];
}

export type TagEntry = { id: string; name: string; color: TicketStatusColor };

export interface BadgeContext {
  statusOptions: { name: string; color: TicketStatusColor }[];
  tags: TagEntry[];
  tagMap: Map<string, TagEntry>;
  ticketShorthandById?: Record<string, string>;
}
