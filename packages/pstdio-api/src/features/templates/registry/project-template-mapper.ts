import type { Template } from "pstdio-api-contracts";

export type ProjectTemplateRow = {
  id: string;
  project_id: string | null;
  name: string;
  template_type: string;
  file_id: string;
  is_default: boolean;
  origin_extension_id: string | null;
  origin_template_key: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export const projectTemplateRowToTemplate = (template: ProjectTemplateRow): Template => ({
  id: template.id,
  project_id: template.project_id,
  name: template.name,
  template_type: template.template_type,
  file_id: template.file_id,
  is_default: template.is_default,
  source_kind: "project",
  read_only: false,
  extension_id: null,
  template_key: null,
  origin_extension_id: template.origin_extension_id,
  origin_template_key: template.origin_template_key,
  created_at: template.created_at,
  updated_at: template.updated_at,
  deleted_at: template.deleted_at,
});
