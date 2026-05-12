import type { Template } from "pstdio-api-contracts";
import type {
  createExtensionTemplatePreferencesDBService,
  createProjectTemplateDefaultsDBService,
  createTemplatesDBService,
} from "pstdio-db";
import { loadExtensionSource } from "../features/extensions/extension-runtime";
import {
  catalogId,
  catalogNameFromKey,
  isPackageAssetDescriptor,
  isRecord,
  readTextPackageAsset,
  sourceRootForAsset,
} from "./extension-asset-catalog";
import type { createExtensionService } from "./extension-service";
import type { createFileService } from "./file-service";

type ProjectTemplate = Awaited<ReturnType<ReturnType<typeof createTemplatesDBService>["list"]>>[number];
type DefaultRow = Awaited<ReturnType<ReturnType<typeof createProjectTemplateDefaultsDBService>["list"]>>[number];

type InternalTemplate = Template & { source_path?: string };

type TemplateUpdateInput = {
  content?: string;
  enabled?: boolean;
  is_default?: boolean;
  template_type?: "prompt" | "ticket" | "document";
  title?: string;
};

type TemplateUpdateError =
  | "asset_error"
  | "cannot_change_only_default_template_type"
  | "cannot_update_extension_template_content"
  | "cannot_update_extension_template_type"
  | "not_found";
type TemplateUpdateResult = { template: Template } | { error: TemplateUpdateError; message?: string };

export type TemplateServiceDeps = {
  extensionService: ReturnType<typeof createExtensionService>;
  extensionTemplatePreferencesDBService: ReturnType<typeof createExtensionTemplatePreferencesDBService>;
  fileService: ReturnType<typeof createFileService>;
  projectTemplateDefaultsDBService: ReturnType<typeof createProjectTemplateDefaultsDBService>;
  templatesDBService: ReturnType<typeof createTemplatesDBService>;
};

type EnabledExtensionSource = Awaited<
  ReturnType<TemplateServiceDeps["extensionService"]["listEnabledSourcesForProject"]>
>[number];
type ExtensionTemplatePreference = Awaited<
  ReturnType<TemplateServiceDeps["extensionTemplatePreferencesDBService"]["list"]>
>[number];

type TemplateDefaults = {
  defaultByType: Map<string, DefaultRow>;
  projectDefaultByTypeAndName: Set<string>;
};

const toProjectTemplate = (template: ProjectTemplate): InternalTemplate => ({
  ...template,
  source_kind: "project",
  title: template.name,
  editable: true,
});

const toPublicTemplate = (template: InternalTemplate): Template => {
  const { source_path: _sourcePath, ...publicTemplate } = template;
  return publicTemplate;
};

const preferenceKey = (extensionInstanceId: string, key: string) => `${extensionInstanceId}:${key}`;

const defaultMatchesExtension = (row: DefaultRow | undefined, item: InternalTemplate) =>
  row?.source === "extension_template" &&
  row.extension_instance_id === item.extension_instance_id &&
  row.template_key === item.key;

const buildTemplateDefaults = (defaults: DefaultRow[], projectTemplates: InternalTemplate[]): TemplateDefaults => ({
  defaultByType: new Map(defaults.map((row) => [row.template_type, row])),
  projectDefaultByTypeAndName: new Set(
    projectTemplates
      .filter((template) => template.is_default)
      .map((template) => `${template.template_type}:${template.name}`),
  ),
});

const extensionTemplateTitle = (
  contribution: Record<string, unknown>,
  pref: ExtensionTemplatePreference | undefined,
  key: string,
) =>
  pref?.display_name_override ??
  (typeof contribution.title === "string" ? contribution.title : catalogNameFromKey(key));

const toExtensionTemplate = (input: {
  contribution: unknown;
  defaults: TemplateDefaults;
  includeDisabled: boolean;
  installedSource: EnabledExtensionSource["installedSource"];
  instance: EnabledExtensionSource["instance"];
  key: string;
  pref: ExtensionTemplatePreference | undefined;
  projectId: string;
}) => {
  if (!isRecord(input.contribution) || !isPackageAssetDescriptor(input.contribution.source)) return null;

  const enabled = input.pref?.enabled ?? true;
  if (!enabled && !input.includeDisabled) return null;

  const name = catalogNameFromKey(input.key);
  const templateType = typeof input.contribution.type === "string" ? input.contribution.type : "document";
  const item: InternalTemplate = {
    id: catalogId({ sourceKind: "template", extensionInstanceId: input.instance.id, key: input.key }),
    project_id: input.projectId,
    source_kind: "extension",
    extension_instance_id: input.instance.id,
    extension_id: input.installedSource.extension_id,
    installed_extension_id: input.installedSource.id,
    install_name: input.installedSource.install_name,
    key: input.key,
    name,
    title: extensionTemplateTitle(input.contribution, input.pref, input.key),
    template_type: templateType,
    source: input.contribution.source,
    enabled,
    editable: true,
    is_default: false,
    created_at: input.instance.created_at,
    updated_at: input.instance.updated_at,
    deleted_at: null,
    source_path: input.installedSource.source_path,
  };

  const defaultRow = input.defaults.defaultByType.get(templateType);
  item.is_default =
    defaultMatchesExtension(defaultRow, item) ||
    input.defaults.projectDefaultByTypeAndName.has(`${templateType}:${name}`);

  return item;
};

const loadExtensionTemplates = async (
  deps: TemplateServiceDeps,
  projectId: string,
  input: { includeDisabled: boolean; projectTemplates: InternalTemplate[] },
) => {
  const [enabledSources, preferences, defaults] = await Promise.all([
    deps.extensionService.listEnabledSourcesForProject(projectId),
    deps.extensionTemplatePreferencesDBService.list(projectId),
    deps.projectTemplateDefaultsDBService.list(projectId),
  ]);
  const preferenceByKey = new Map(
    preferences.map((pref) => [preferenceKey(pref.extension_instance_id, pref.template_key), pref]),
  );
  const templateDefaults = buildTemplateDefaults(defaults, input.projectTemplates);
  const items: InternalTemplate[] = [];

  for (const { instance, installedSource } of enabledSources) {
    if (installedSource.status !== "loaded") continue;

    const loaded = await loadExtensionSource(installedSource.source_path);
    const templates = loaded.definition.templates;
    if (!isRecord(templates)) continue;

    for (const [key, contribution] of Object.entries(templates)) {
      const item = toExtensionTemplate({
        contribution,
        defaults: templateDefaults,
        includeDisabled: input.includeDisabled,
        installedSource,
        instance,
        key,
        pref: preferenceByKey.get(preferenceKey(instance.id, key)),
        projectId,
      });
      if (item) items.push(item);
    }
  }

  return items;
};

const listInternal = async (deps: TemplateServiceDeps, projectId: string, includeDisabled = false) => {
  const projectTemplates = (await deps.templatesDBService.list(projectId)).map(toProjectTemplate);
  const extensionTemplates = await loadExtensionTemplates(deps, projectId, { includeDisabled, projectTemplates });
  const extensionNames = new Set(extensionTemplates.filter((item) => item.enabled !== false).map((item) => item.name));
  const visibleProjectTemplates = projectTemplates.filter((template) => !extensionNames.has(template.name));

  return [...visibleProjectTemplates, ...extensionTemplates].sort((a, b) => a.name.localeCompare(b.name));
};

const findByNameInternal = async (
  deps: TemplateServiceDeps,
  projectId: string,
  name: string,
  includeDisabled = false,
) => {
  const templates = await listInternal(deps, projectId, includeDisabled);
  return templates.find((template) => template.name === name) ?? null;
};

const readProjectTemplateContent = async (deps: TemplateServiceDeps, template: InternalTemplate) => {
  if (!template.file_id) return "";
  const file = await deps.fileService.get(template.file_id);
  if (!file) return "";
  return Bun.file(file.storage_path).text();
};

const updateProjectTemplate = async (
  deps: TemplateServiceDeps,
  projectId: string,
  name: string,
  input: TemplateUpdateInput,
): Promise<TemplateUpdateResult> => {
  let updated = await deps.templatesDBService.getByName(projectId, name);
  if (!updated) return { error: "not_found" };

  if (input.is_default !== undefined || input.template_type !== undefined) {
    const result = await deps.templatesDBService.update(projectId, name, {
      is_default: input.is_default,
      template_type: input.template_type,
    });
    if ("error" in result && result.error) return { error: result.error };
    updated = result.template;
  }

  if (input.content) {
    const file = await deps.fileService.update(updated.file_id, {
      data: Buffer.from(input.content),
    });

    if (file) {
      const result = await deps.templatesDBService.update(projectId, name, { file_id: file.id });
      if ("error" in result && result.error) return { error: result.error };
      updated = result.template;
    }
  }

  return { template: toPublicTemplate(toProjectTemplate(updated)) };
};

const updateExtensionTemplate = async (
  deps: TemplateServiceDeps,
  projectId: string,
  name: string,
  template: InternalTemplate,
  input: TemplateUpdateInput,
): Promise<TemplateUpdateResult> => {
  if (input.template_type !== undefined && input.template_type !== template.template_type) {
    return { error: "cannot_update_extension_template_type" };
  }

  if (input.content !== undefined) {
    return { error: "cannot_update_extension_template_content" };
  }

  if (input.enabled !== undefined || input.title !== undefined) {
    await deps.extensionTemplatePreferencesDBService.set({
      project_id: projectId,
      extension_instance_id: template.extension_instance_id!,
      template_key: template.key!,
      enabled: input.enabled,
      display_name_override: input.title,
    });
  }

  if (input.is_default === true) {
    await deps.projectTemplateDefaultsDBService.set({
      project_id: projectId,
      template_type: template.template_type,
      source: "extension_template",
      extension_instance_id: template.extension_instance_id!,
      template_key: template.key!,
    });
  }

  if (input.is_default === false || input.enabled === false) {
    const currentDefault = await deps.projectTemplateDefaultsDBService.get(projectId, template.template_type);
    if (defaultMatchesExtension(currentDefault, template)) {
      await deps.projectTemplateDefaultsDBService.remove(projectId, template.template_type);
    }
  }

  const refreshed = await findByNameInternal(deps, projectId, name, true);
  if (!refreshed) return { error: "not_found" };
  return { template: toPublicTemplate(refreshed) };
};

export const createTemplateService = (deps: TemplateServiceDeps) => {
  const list = async (projectId: string) => (await listInternal(deps, projectId)).map(toPublicTemplate);

  const getByName = async (projectId: string, name: string) => {
    const template = await findByNameInternal(deps, projectId, name);
    return template ? toPublicTemplate(template) : null;
  };

  const getWithContent = async (projectId: string, name: string) => {
    const template = await findByNameInternal(deps, projectId, name);
    if (!template) return null;

    if (template.source_kind === "project") {
      return { ...toPublicTemplate(template), content: await readProjectTemplateContent(deps, template) };
    }

    return {
      ...toPublicTemplate(template),
      content: readTextPackageAsset(sourceRootForAsset(template.source_path!), template.source),
    };
  };

  const create = async (input: Parameters<TemplateServiceDeps["templatesDBService"]["create"]>[0]) =>
    toPublicTemplate(toProjectTemplate(await deps.templatesDBService.create(input)));

  const update = async (projectId: string, name: string, input: TemplateUpdateInput) => {
    const template = await findByNameInternal(deps, projectId, name, true);
    if (!template) return { error: "not_found" } as const;
    if (template.source_kind === "extension") return updateExtensionTemplate(deps, projectId, name, template, input);
    return updateProjectTemplate(deps, projectId, name, input);
  };

  const remove = async (projectId: string, name: string) => {
    const template = await findByNameInternal(deps, projectId, name);
    if (template?.source_kind === "extension") {
      const result = await updateExtensionTemplate(deps, projectId, name, template, { enabled: false });
      return "template" in result ? result.template : null;
    }

    const removed = await deps.templatesDBService.remove(projectId, name);
    return removed ? toPublicTemplate(toProjectTemplate(removed)) : null;
  };

  return {
    list,
    getByName,
    getWithContent,
    create,
    update,
    remove,
    hardRemove: deps.templatesDBService.hardRemove,
  };
};
