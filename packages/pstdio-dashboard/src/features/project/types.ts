import type { Project as ContractProject } from "pstdio-api-contracts";
import type { TicketStatus, TicketStatusOption, TicketTag } from "@/features/ticket-list/types";

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
  templateType: ProjectTemplateAssetType;
  fileId: string;
  content: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export type Project = ContractProject & {
  ticketStatuses: TicketStatus[];
  ticketStatusOptions: TicketStatusOption[];
  repositories: ProjectRepository[];
  ticketTags: TicketTag[];
};
