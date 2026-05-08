import { readFile } from "node:fs/promises";
import type { Skill, SkillFile } from "pstdio-api-contracts";
import type { createExtensionSkillPreferencesDBService, createSkillsDBService } from "pstdio-db";
import type { createSkillsStorageService } from "pstdio-storage";
import { loadExtensionSource } from "../features/extensions/extension-runtime";
import {
  catalogId,
  catalogNameFromKey,
  isPackageAssetDescriptor,
  isRecord,
  readSkillPackageAssetFiles,
  sourceRootForAsset,
} from "./extension-asset-catalog";
import type { createExtensionService } from "./extension-service";
import type { createFileService } from "./file-service";

type DbSkill = Awaited<ReturnType<ReturnType<typeof createSkillsDBService>["getByName"]>>;
type ProjectSkill = NonNullable<DbSkill>;

type InternalSkill = Skill & {
  source_path?: string;
};

export type SkillServiceDeps = {
  extensionService: ReturnType<typeof createExtensionService>;
  extensionSkillPreferencesDBService: ReturnType<typeof createExtensionSkillPreferencesDBService>;
  fileService: ReturnType<typeof createFileService>;
  skillsDBService: ReturnType<typeof createSkillsDBService>;
  skillsStorageService: ReturnType<typeof createSkillsStorageService>;
};

type EnabledExtensionSource = Awaited<
  ReturnType<SkillServiceDeps["extensionService"]["listEnabledSourcesForProject"]>
>[number];
type ExtensionSkillPreference = Awaited<
  ReturnType<SkillServiceDeps["extensionSkillPreferencesDBService"]["list"]>
>[number];

const preferenceKey = (extensionInstanceId: string, key: string) => `${extensionInstanceId}:${key}`;

const toPublicSkill = (skill: InternalSkill): Skill => {
  const { source_path: _sourcePath, ...publicSkill } = skill;
  return publicSkill;
};

const readSkillFileContent = async (fileService: SkillServiceDeps["fileService"], fileId: string): Promise<string> => {
  const file = await fileService.get(fileId);
  if (!file) return "";
  return readFile(file.storage_path, "utf8");
};

const hydrateProjectSkill = async (
  fileService: SkillServiceDeps["fileService"],
  skill: ProjectSkill,
): Promise<InternalSkill> => {
  const files: SkillFile[] = await Promise.all(
    skill.files.map(async (membership) => ({
      path: membership.path,
      content: await readSkillFileContent(fileService, membership.file_id),
      encoding: "utf8" as const,
    })),
  );

  return {
    id: skill.id,
    project_id: skill.project_id,
    source_kind: "project",
    name: skill.name,
    title: skill.name,
    description: skill.description,
    files,
    editable: true,
    created_at: skill.created_at,
    updated_at: skill.updated_at,
    deleted_at: skill.deleted_at,
  };
};

const ingestSkillFiles = async (fileService: SkillServiceDeps["fileService"], projectId: string, files: SkillFile[]) =>
  Promise.all(
    files.map(async (file) => {
      const uploaded = await fileService.upload({
        project_id: projectId,
        file_name: file.path,
        file_kind: "skill",
        data: Buffer.from(file.content, file.encoding ?? "utf8"),
      });
      return { path: file.path, file_id: uploaded.id };
    }),
  );

const extensionSkillTitle = (
  contribution: Record<string, unknown>,
  pref: ExtensionSkillPreference | undefined,
  key: string,
) =>
  pref?.display_name_override ??
  (typeof contribution.title === "string" ? contribution.title : catalogNameFromKey(key));

const extensionSkillDescription = (contribution: Record<string, unknown>, pref: ExtensionSkillPreference | undefined) =>
  pref?.description_override ?? (typeof contribution.description === "string" ? contribution.description : "");

const toExtensionSkill = (input: {
  contribution: unknown;
  includeDisabled: boolean;
  installedSource: EnabledExtensionSource["installedSource"];
  instance: EnabledExtensionSource["instance"];
  key: string;
  pref: ExtensionSkillPreference | undefined;
  projectId: string;
}) => {
  if (!isRecord(input.contribution) || !isPackageAssetDescriptor(input.contribution.source)) return null;

  const enabled = input.pref?.enabled ?? true;
  if (!enabled && !input.includeDisabled) return null;

  const name = catalogNameFromKey(input.key);

  return {
    id: catalogId({ sourceKind: "skill", extensionInstanceId: input.instance.id, key: input.key }),
    project_id: input.projectId,
    source_kind: "extension",
    extension_instance_id: input.instance.id,
    extension_id: input.installedSource.extension_id,
    installed_extension_id: input.installedSource.id,
    install_name: input.installedSource.install_name,
    namespace: input.instance.namespace,
    key: input.key,
    name,
    title: extensionSkillTitle(input.contribution, input.pref, input.key),
    description: extensionSkillDescription(input.contribution, input.pref),
    files: readSkillPackageAssetFiles(sourceRootForAsset(input.installedSource.source_path), input.contribution.source),
    source: input.contribution.source,
    enabled,
    editable: true,
    created_at: input.instance.created_at,
    updated_at: input.instance.updated_at,
    deleted_at: null,
    source_path: input.installedSource.source_path,
  } satisfies InternalSkill;
};

const listExtensionSkills = async (deps: SkillServiceDeps, projectId: string, input: { includeDisabled: boolean }) => {
  const [enabledSources, preferences] = await Promise.all([
    deps.extensionService.listEnabledSourcesForProject(projectId),
    deps.extensionSkillPreferencesDBService.list(projectId),
  ]);
  const preferenceByKey = new Map(
    preferences.map((pref) => [preferenceKey(pref.extension_instance_id, pref.skill_key), pref]),
  );
  const items: InternalSkill[] = [];

  for (const { instance, installedSource } of enabledSources) {
    if (installedSource.status !== "loaded") continue;

    const loaded = await loadExtensionSource(installedSource.source_path);
    const skills = loaded.definition.skills;
    if (!isRecord(skills)) continue;

    for (const [key, contribution] of Object.entries(skills)) {
      const item = toExtensionSkill({
        contribution,
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

const listInternal = async (deps: SkillServiceDeps, projectId: string, includeDisabled = false) => {
  const projectSkills = await Promise.all(
    (await deps.skillsDBService.list(projectId)).map((skill) => hydrateProjectSkill(deps.fileService, skill)),
  );
  const extensionSkills = await listExtensionSkills(deps, projectId, { includeDisabled });
  const extensionNames = new Set(extensionSkills.filter((skill) => skill.enabled !== false).map((skill) => skill.name));
  const visibleProjectSkills = projectSkills.filter((skill) => !extensionNames.has(skill.name));

  return [...visibleProjectSkills, ...extensionSkills].sort((a, b) => a.name.localeCompare(b.name));
};

const findByNameInternal = async (deps: SkillServiceDeps, projectId: string, name: string, includeDisabled = false) => {
  const skills = await listInternal(deps, projectId, includeDisabled);
  return (
    skills.find((skill) => skill.source_kind === "extension" && skill.name === name) ??
    skills.find((skill) => skill.name === name) ??
    null
  );
};

export const createSkillService = (deps: SkillServiceDeps) => {
  const list = async (projectId: string) => (await listInternal(deps, projectId)).map(toPublicSkill);

  const getByName = async (projectId: string, name: string) => {
    const skill = await findByNameInternal(deps, projectId, name);
    return skill ? toPublicSkill(skill) : null;
  };

  const create = async (input: { project_id: string; name: string; description: string; files: SkillFile[] }) => {
    const ingested = await ingestSkillFiles(deps.fileService, input.project_id, input.files);
    const created = await deps.skillsDBService.create({
      project_id: input.project_id,
      name: input.name,
      description: input.description,
      files: ingested,
    });
    return toPublicSkill(await hydrateProjectSkill(deps.fileService, created));
  };

  const update = async (projectId: string, name: string, input: { description?: string; files?: SkillFile[] }) => {
    if (!input.files) {
      const updated = await deps.skillsDBService.update(projectId, name, {
        description: input.description,
      });
      if (!updated) return null;
      return toPublicSkill(await hydrateProjectSkill(deps.fileService, updated));
    }

    const existing = await deps.skillsDBService.getByName(projectId, name);
    if (!existing) return null;

    const ingested = await ingestSkillFiles(deps.fileService, projectId, input.files);
    const updated = await deps.skillsDBService.update(projectId, name, {
      description: input.description,
      files: ingested,
    });
    if (!updated) return null;

    for (const previous of existing.files) {
      await deps.fileService.remove(previous.file_id);
    }

    return toPublicSkill(await hydrateProjectSkill(deps.fileService, updated));
  };

  const setPreference = async (
    projectId: string,
    name: string,
    input: { description?: string; enabled?: boolean; title?: string },
  ) => {
    const skill = await findByNameInternal(deps, projectId, name, true);
    if (!skill) return null;

    if (skill.source_kind === "project") {
      if (input.description === undefined) return toPublicSkill(skill);
      const updated = await deps.skillsDBService.update(projectId, name, { description: input.description });
      return updated ? toPublicSkill(await hydrateProjectSkill(deps.fileService, updated)) : null;
    }

    await deps.extensionSkillPreferencesDBService.set({
      project_id: projectId,
      extension_instance_id: skill.extension_instance_id!,
      skill_key: skill.key!,
      enabled: input.enabled,
      display_name_override: input.title,
      description_override: input.description,
    });

    const refreshed = await findByNameInternal(deps, projectId, name, true);
    return refreshed ? toPublicSkill(refreshed) : null;
  };

  const remove = (projectId: string, name: string) => deps.skillsDBService.remove(projectId, name);

  return {
    ...deps.skillsStorageService,
    list,
    getByName,
    create,
    update,
    setPreference,
    remove,
  };
};
