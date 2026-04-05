import { apiClient } from "@/features/api-client";

type ListTicketsParams = {
  project_id: string;
  status?: string;
  tag?: string[];
  archived?: boolean;
  draft?: boolean;
  parent_id?: string;
  shorthand?: string;
};

export const listTickets = async (params: ListTicketsParams) =>
  apiClient().tickets.list(params.project_id, {
    status: params.status,
    tag: params.tag,
    archived: params.archived,
    draft: params.draft,
    parent_id: params.parent_id,
    shorthand: params.shorthand,
  });
