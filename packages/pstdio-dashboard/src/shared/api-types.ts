export type ApiWorkspaceArtifact = {
  id: string;
  file_id: string;
  file_name: string;
  file_kind: string;
  relative_path: string;
  mime_type: string | null;
  size_bytes: number;
  created_at: string;
  updated_at: string;
};

export type ApiFileDiff = {
  filePath: string;
  change: "added" | "deleted" | "modified" | "renamed" | "copied" | "permissionChange";
  additions: number;
  deletions: number;
  oldContent: string;
  newContent: string;
  oldPath?: string;
  newPath?: string;
};
