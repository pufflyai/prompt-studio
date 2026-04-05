export type TemplateType = "prompt" | "ticket" | "document";

export type Template = {
  id: string;
  project_id: string | null;
  name: string;
  template_type: string;
  file_id: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type TemplateWithContent = Template & { content: string };
