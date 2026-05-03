import type { Template } from "pstdio-api-contracts";
import type { RouteDeps } from "../../deps";
import { findExtensionTemplate, readExtensionTemplateContent } from "./extension-content";
import { projectTemplateRowToTemplate } from "./project-template-mapper";

export type CopyExtensionTemplateInput = {
  projectId: string;
  extensionId: string;
  templateKey: string;
  name?: string;
  isDefault?: boolean;
};

export type CopyExtensionTemplateResult =
  | { ok: true; template: Template }
  | { ok: false; error: "extension_template_not_found" | "asset_unreadable" | "name_conflict"; message: string };

const buildDefaultName = (extensionId: string, templateKey: string) => `${extensionId}.${templateKey}`;

export const copyExtensionTemplate = async (
  deps: RouteDeps,
  input: CopyExtensionTemplateInput,
): Promise<CopyExtensionTemplateResult> => {
  const resolved = await findExtensionTemplate(deps, input.extensionId, input.templateKey);
  if (!resolved) {
    return {
      ok: false,
      error: "extension_template_not_found",
      message: `Extension template not found: ${input.extensionId}.${input.templateKey}`,
    };
  }

  let content: string;
  try {
    content = await readExtensionTemplateContent(resolved);
  } catch (error) {
    return {
      ok: false,
      error: "asset_unreadable",
      message: `Cannot read extension template asset: ${error instanceof Error ? error.message : String(error)}`,
    };
  }

  const name = input.name ?? buildDefaultName(input.extensionId, input.templateKey);
  const existing = await deps.templateService.getByName(input.projectId, name);
  if (existing) {
    return { ok: false, error: "name_conflict", message: `Template already exists: ${name}` };
  }

  const file = await deps.fileService.upload({
    project_id: input.projectId,
    file_name: `${name}.md`,
    file_kind: "template",
    data: Buffer.from(content),
    mime_type: "text/markdown",
  });

  const template = await deps.templateService.create({
    project_id: input.projectId,
    name,
    template_type: resolved.record.contribution.type,
    file_id: file.id,
    is_default: input.isDefault ?? false,
    origin_extension_id: input.extensionId,
    origin_template_key: input.templateKey,
  });

  const response = projectTemplateRowToTemplate(template);
  deps.eventBus.emit("templates", "set", response);

  return { ok: true, template: response };
};
