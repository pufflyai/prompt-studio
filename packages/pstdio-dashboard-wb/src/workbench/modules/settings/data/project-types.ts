import type { Project as ContractProject } from "@pstdio/sdk/resources";

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

export type StatusAction = "create_ticket" | "drag_in" | "drag_out" | "archive_all";

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
  actions: StatusAction[];
}

export type TagType = "single_select" | "multi_select";

export interface TagOption {
  id: string;
  name: string;
  color: TicketStatusColor;
  sortOrder: number;
  icon: string | null;
  description: string | null;
}

export interface TicketTag {
  id: string;
  name: string;
  type: TagType;
  options: TagOption[];
}

export interface ProjectRepository {
  id: string;
  name: string;
  displayName: string | null;
  path: string;
  createdAt: string;
  updatedAt: string;
}

export interface RepoBranch {
  name: string;
  isCurrent: boolean;
  isRemote: boolean;
  lastCommitDate: string;
}

export type ProjectTemplateAssetType = "prompt" | "ticket" | "document";

export interface ProjectTemplateAsset {
  id: string;
  projectId: string;
  name: string;
  title: string;
  templateType: ProjectTemplateAssetType;
  sourceKind: "project" | "extension";
  installName?: string;
  key?: string;
  fileId?: string;
  content: string;
  isDefault: boolean;
  enabled?: boolean;
  createdAt: string;
  updatedAt: string;
}

export type Project = ContractProject & {
  ticketStatuses: TicketStatus[];
  ticketStatusOptions: TicketStatusOption[];
  repositories: ProjectRepository[];
  ticketTags: TicketTag[];
};
