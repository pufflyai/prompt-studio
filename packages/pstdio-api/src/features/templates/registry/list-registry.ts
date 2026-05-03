import type { Template } from "pstdio-api-contracts";
import { resolvePackageAssetPath } from "pstdio-extensions";
import type { RuntimeTemplateRecord } from "pstdio-extensions/types";
import type { RouteDeps } from "../../deps";

export type ListTemplateRegistryOptions = {
  type?: string;
  includeDisabledExtensionDefaults?: boolean;
};

export const extensionDefaultTemplateId = (extensionId: string, key: string) => `extension:${extensionId}:${key}`;
export const extensionDefaultTemplateName = (record: { namespace: string; localId: string }) =>
  `${record.namespace}.${record.localId}`;

const projectRowToTemplate = (template: {
  id: string;
  project_id: string | null;
  name: string;
  template_type: string;
  file_id: string | null;
  is_default: boolean;
  extension_id: string | null;
  origin_extension_id: string | null;
  origin_template_key: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}): Template => ({
  id: template.id,
  project_id: template.project_id,
  name: template.name,
  template_type: template.template_type,
  file_id: template.file_id ?? "",
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

const extensionDefaultToTemplate = (record: RuntimeTemplateRecord, projectId: string): Template => {
  let assetPath = "";
  try {
    assetPath = resolvePackageAssetPath(record.contribution.source, { sourcePath: record.sourcePath });
  } catch {
    assetPath = "";
  }

  return {
    id: extensionDefaultTemplateId(record.extensionId, record.localId),
    project_id: projectId,
    name: extensionDefaultTemplateName(record),
    template_type: record.contribution.type,
    file_id: assetPath,
    is_default: false,
    source_kind: "extension-default",
    read_only: true,
    extension_id: record.extensionId,
    template_key: record.localId,
    origin_extension_id: null,
    origin_template_key: null,
    created_at: new Date(0).toISOString(),
    updated_at: new Date(0).toISOString(),
    deleted_at: null,
  };
};

export const listTemplateRegistry = async (
  deps: RouteDeps,
  projectId: string,
  options: ListTemplateRegistryOptions = {},
): Promise<Template[]> => {
  const checkResult = await deps.extensionService.check();
  const runtimeTemplates = checkResult.runtime.templates;

  const extensionItems: Template[] = [];
  for (const record of runtimeTemplates) {
    if (options.type && record.contribution.type !== options.type) continue;
    const enabled = await deps.extensionService.templatePreferences.isEnabled(
      projectId,
      record.extensionId,
      record.localId,
    );
    if (!enabled && !options.includeDisabledExtensionDefaults) continue;
    extensionItems.push(extensionDefaultToTemplate(record, projectId));
  }

  const projectTemplates = await deps.templateService.list(projectId);
  const projectItems = projectTemplates
    .filter(
      (template) =>
        template.extension_id === null &&
        template.file_id !== null &&
        (!options.type || template.template_type === options.type),
    )
    .map(projectRowToTemplate);

  return [...extensionItems, ...projectItems];
};
