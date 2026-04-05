export type Workspace = {
  id: string;
  project_id: string;
  name: string;
  branch: string | null;
  worktree_path: string | null;
  attempt_status_id: string | null;
  archived: boolean;
  workspace_shorthand: string;
  startup_log_file_id: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type WorkspaceListItem = Workspace & {
  ticket_shorthand: string;
  attempt_status_name: string | null;
};
