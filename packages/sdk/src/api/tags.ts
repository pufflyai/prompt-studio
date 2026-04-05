export type CreateTagInput = {
  name: string;
  type: "single_select" | "multi_select";
  options?: { name: string; color: string }[];
};

export type UpdateTagInput = {
  name?: string;
  type?: "single_select" | "multi_select";
};

export type CreateTagOptionInput = {
  name: string;
  color: string;
  icon?: string;
  description?: string;
};

export type UpdateTagOptionInput = {
  name?: string;
  color?: string;
  sort_order?: number;
  icon?: string | null;
  description?: string | null;
};
