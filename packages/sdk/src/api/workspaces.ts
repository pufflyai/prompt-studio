export type CreateWorkspaceInput = {
  project_id: string;
  ticket_id: string;
  ticket_shorthand: string;
  branch?: string;
  worktree_path?: string;
};

export type UpdateAttemptStatusInput = {
  status: string;
  session_id?: string;
};

export type UpdateAttemptStatusResponse = {
  id: string;
  attempt_status_id: string | null;
  from_status: string | null;
  to_status: string;
  status_change_id: string;
};

export type RemoveWorktreeResponse = {
  removed: boolean;
};
