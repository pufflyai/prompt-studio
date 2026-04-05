export type Status = {
  id: string;
  project_id: string;
  name: string;
  color: string;
  sort_order: number;
  is_default: boolean;
  can_create: boolean;
  can_drag_in: boolean;
  can_drag_out: boolean;
  column_actions: string[];
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type AttemptStatus = {
  id: string;
  name: string;
  color: string;
  sort_order: number;
  is_default: boolean;
};
