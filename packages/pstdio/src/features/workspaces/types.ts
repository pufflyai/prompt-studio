export type Workspace = {
  id: string;
  project_id: string;
  name: string;
  workspace_shorthand: string;
  branch: string | null;
  worktree_path: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};
