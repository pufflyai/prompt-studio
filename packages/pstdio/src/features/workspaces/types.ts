export type Workspace = {
  id: string;
  project_id: string;
  name: string;
  workspace_shorthand: string;
  branch: string | null;
  root_path: string | null;
  created_at: string;
  updated_at: string;
};
