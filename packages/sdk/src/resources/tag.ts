export type TagOption = {
  id: string;
  name: string;
  color: string;
  icon: string | null;
  description: string | null;
  sort_order: number;
};

export type Tag = {
  id: string;
  project_id: string;
  name: string;
  type: string;
  options: TagOption[];
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};
