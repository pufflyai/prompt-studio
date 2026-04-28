import type { RuntimeTemplate } from "@pstdio/sdk/extensions";
import {
  type createExtensionInstancesDBService,
  createExtensionTemplatePreferencesDBService,
  type DbClient,
} from "pstdio-db";
import { readPackageAssetText } from "pstdio-extensions";
import type { EventBus } from "../features/sync/event-bus";
import { findExtensionSourcePath, loadProjectExtensionRuntime } from "./extension-registry-runtime";
import type { createFileService } from "./file-service";
import type { createRepoService } from "./repo-service";
import type { createTemplateService } from "./template-service";

type TemplateRegistryServiceDeps = {
  db: DbClient;
  eventBus: EventBus;
  extensionInstancesDBService: ReturnType<typeof createExtensionInstancesDBService>;
  fileService: ReturnType<typeof createFileService>;
  filesRoot: string;
  repoService: ReturnType<typeof createRepoService>;
  templateService: ReturnType<typeof createTemplateService>;
};

type CopyTemplateInput = {
  name?: string;
  is_default?: boolean;
};

const defaultTimestamp = "1970-01-01T00:00:00.000Z";

const toProjectTemplate = (
  template: Awaited<ReturnType<ReturnType<typeof createTemplateService>["list"]>>[number],
) => ({
  ...template,
  source_kind: "project" as const,
  read_only: false,
});

const toExtensionTemplate = (projectId: string, template: RuntimeTemplate) => ({
  id: template.id,
  project_id: projectId,
  name: template.id,
  template_type: template.type,
  file_id: `extension:${template.id}`,
  is_default: false,
  source_kind: "extension-default" as const,
  read_only: true,
  title: template.title,
  description: template.description,
  origin_extension_id: template.extensionId,
  origin_template_key: template.key,
  created_at: defaultTimestamp,
  updated_at: defaultTimestamp,
  deleted_at: null,
});

const slugify = (value: string) => {
  const slug = value
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "extension-template";
};

export const createTemplateRegistryService = (deps: TemplateRegistryServiceDeps) => {
  const preferences = createExtensionTemplatePreferencesDBService(deps.db);
  const runtimeCache = new Map<string, Awaited<ReturnType<typeof loadProjectExtensionRuntime>>>();
  const runtimeDeps = {
    extensionInstancesDBService: deps.extensionInstancesDBService,
    filesRoot: deps.filesRoot,
    repoService: deps.repoService,
  };

  const loadRuntime = async (projectId: string) => {
    const [repo] = await deps.repoService.listByProject(projectId);
    const cacheKey = `${projectId}:${repo?.path ?? ""}`;
    const cached = runtimeCache.get(cacheKey);
    if (cached) return cached;

    const runtime = await loadProjectExtensionRuntime(runtimeDeps, projectId);
    runtimeCache.set(cacheKey, runtime);
    return runtime;
  };

  const readTemplateContent = async (
    runtime: Awaited<ReturnType<typeof loadProjectExtensionRuntime>>,
    template: RuntimeTemplate,
  ) => {
    const sourcePath = findExtensionSourcePath(runtime, template.extensionId);
    if (!sourcePath) throw new Error(`Extension source not found: ${template.extensionId}`);
    return readPackageAssetText(template.source, { sourcePath });
  };

  const getExtensionTemplate = async (
    projectId: string,
    name: string,
    options: { includeDisabledPreference?: boolean } = {},
  ) => {
    const runtime = await loadRuntime(projectId);
    const template = runtime.templates.find((candidate) => candidate.id === name);
    if (!template) return null;

    if (!options.includeDisabledPreference) {
      const enabled = await preferences.isEnabled(projectId, template.extensionId, template.key);
      if (!enabled) return null;
    }

    return { runtime, template };
  };

  const list = async (projectId: string, filters: { type?: string } = {}) => {
    const [projectTemplates, runtime] = await Promise.all([
      deps.templateService.list(projectId),
      loadRuntime(projectId),
    ]);
    const templates: Array<ReturnType<typeof toProjectTemplate> | ReturnType<typeof toExtensionTemplate>> =
      projectTemplates.map(toProjectTemplate);

    for (const template of runtime.templates) {
      if (filters.type && template.type !== filters.type) continue;
      const enabled = await preferences.isEnabled(projectId, template.extensionId, template.key);
      if (enabled) templates.push(toExtensionTemplate(projectId, template));
    }

    return templates
      .filter((template) => !filters.type || template.template_type === filters.type)
      .sort((a, b) => a.name.localeCompare(b.name));
  };

  const get = async (projectId: string, name: string) => {
    const projectTemplate = await deps.templateService.getByName(projectId, name);
    if (projectTemplate) {
      const file = await deps.fileService.get(projectTemplate.file_id);
      const content = file ? await Bun.file(file.storage_path).text() : "";
      return { ...toProjectTemplate(projectTemplate), content };
    }

    const found = await getExtensionTemplate(projectId, name);
    if (!found) return null;

    const content = await readTemplateContent(found.runtime, found.template);
    return { ...toExtensionTemplate(projectId, found.template), content };
  };

  const findExtensionDefault = (projectId: string, name: string) =>
    getExtensionTemplate(projectId, name, { includeDisabledPreference: true });

  const setDefaultEnabled = async (projectId: string, name: string, enabled: boolean) => {
    const found = await findExtensionDefault(projectId, name);
    if (!found) return null;

    const record = await preferences.setEnabled(projectId, found.template.extensionId, found.template.key, enabled);
    deps.eventBus.emit("extension_template_preferences", "set", record);
    return toExtensionTemplate(projectId, found.template);
  };

  const copyDefault = async (projectId: string, name: string, input: CopyTemplateInput = {}) => {
    const found = await findExtensionDefault(projectId, name);
    if (!found) return { error: "not_found" as const };

    const copyName = input.name ?? slugify(found.template.title || found.template.key);
    const existing = await deps.templateService.getByName(projectId, copyName);
    if (existing) return { error: "conflict" as const };

    const content = await readTemplateContent(found.runtime, found.template);
    const file = await deps.fileService.upload({
      project_id: projectId,
      file_name: `${copyName}.md`,
      file_kind: "template",
      data: Buffer.from(content),
      mime_type: "text/markdown",
    });

    const copied = await deps.templateService.create({
      project_id: projectId,
      name: copyName,
      template_type: found.template.type,
      file_id: file.id,
      is_default: input.is_default,
      origin_extension_id: found.template.extensionId,
      origin_template_key: found.template.key,
    });

    deps.eventBus.emit("files", "set", file);
    deps.eventBus.emit("templates", "set", copied);

    return { template: toProjectTemplate(copied) };
  };

  return { copyDefault, findExtensionDefault, get, list, setDefaultEnabled };
};
