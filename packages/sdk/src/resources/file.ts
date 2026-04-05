export type FileRecord = {
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
