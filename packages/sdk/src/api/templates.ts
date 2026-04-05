import type { TemplateType } from "../resources";

export type CreateTemplateInput = {
  name: string;
  template_type: TemplateType;
  content?: string;
  is_default?: boolean;
};

export type UpdateTemplateInput = {
  content?: string;
  is_default?: boolean;
  template_type?: TemplateType;
};
