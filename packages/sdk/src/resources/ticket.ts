export type Ticket = {
  id: string;
  shorthand: string;
  project_id: string;
  status_id: string | null;
  display_title: string | null;
  user_prompt: string | null;
  file_id: string | null;
  parent_id: string | null;
  parallelizable: string | null;
  blocked_reason: string | null;
  depends_on: string | null;
  draft: boolean;
  archived: boolean;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
};

export type TicketDetail = Ticket & { content: string };

export type TicketListItem = Ticket & {
  status_name: string | null;
  tag_ids: string[];
  tag_names: string[];
};

export type TicketFile = {
  id: string;
  project_id: string;
  file_name: string;
  file_kind: string;
  storage_path: string;
  mime_type: string | null;
  size_bytes: number;
  hash: string | null;
  created_at: string;
  updated_at: string;
};
