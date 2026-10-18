import { readFile } from "node:fs/promises";
import type { PageQuery, Skill, SkillFile } from "pstdio-api-contracts";
import type { createExtensionSkillPreferencesDBService, createSkillsDBService } from "pstdio-db";
import { pageBoundary, pageLimit, queryPage } from "pstdio-db";
import type { ProjectExtensionRuntimeCatalog } from "../features/extensions/project-extension-runtime-catalog";
import type { EventBus } from "../features/sync/event-bus";
import type { createFileService } from "./file-service";
import { hydrateExtensionSkill, type InternalSkill, listExtensionSkills } from "./skill-catalog";

type DbSkill = Awaited<ReturnType<ReturnType<typeof createSkillsDBService>["getByName"]>>;
type ProjectSkill = NonNullable<DbSkill>;

export type SkillServiceDeps = {
  eventBus: EventBus;
  extensionRuntimeCatalog: ProjectExtensionRuntimeCatalog;
  extensionSkillPreferencesDBService: ReturnType<typeof createExtensionSkillPreferencesDBService>;
  fileService: ReturnType<typeof createFileService>;
  skillsDBService: ReturnType<typeof createSkillsDBService>;
};

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

const listInternal = async (deps: SkillServiceDeps, projectId: string, includeDisabled = false) => {
  const projectSkills = await Promise.all(
    (await deps.skillsDBService.list(projectId)).map((skill) => hydrateProjectSkill(deps.fileService, skill)),
  );
  const extensionSkills = await listExtensionSkills(deps, projectId, { includeDisabled });
  const extensionNames = new Set(extensionSkills.filter((skill) => skill.enabled !== false).map((skill) => skill.name));
  const visibleProjectSkills = projectSkills.filter((skill) => !extensionNames.has(skill.name));

  return [...visibleProjectSkills, ...extensionSkills.map(hydrateExtensionSkill)].sort((a, b) =>
    a.name.localeCompare(b.name),
  );
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
  const publish = (skill: InternalSkill | null) => {
    if (!skill) return null;
    const result = toPublicSkill(skill);
    deps.eventBus.emit("skills", "set", result);
    return result;
  };
  const list = async (projectId: string) => (await listInternal(deps, projectId)).map(toPublicSkill);

  const query = async (projectId: string, input: PageQuery = {}) => {
    const scope = `skills:${projectId}`;
    const boundary = pageBoundary(input.cursor, scope);
    const limit = pageLimit(input);
    const extensionSkills = await listExtensionSkills(deps, projectId, { includeDisabled: false });
    const projectSkills = await deps.skillsDBService.queryCandidates(
      projectId,
      input,
      extensionSkills.map((skill) => skill.name),
    );
    const candidates = [...projectSkills, ...extensionSkills.filter((skill) => !boundary || skill.id > boundary)].sort(
      (left, right) => (left.id < right.id ? -1 : Number(left.id > right.id)),
    );
    const page = queryPage(candidates, limit, scope);
    const items = await Promise.all(
      page.rows.map(async (skill) => {
        const hydrated =
          "source_kind" in skill ? hydrateExtensionSkill(skill) : await hydrateProjectSkill(deps.fileService, skill);
        return toPublicSkill(hydrated);
      }),
    );
    return { items, nextCursor: page.nextCursor };
  };

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
    return publish(await hydrateProjectSkill(deps.fileService, created))!;
  };

  const update = async (projectId: string, name: string, input: { description?: string; files?: SkillFile[] }) => {
    if (!input.files) {
      const updated = await deps.skillsDBService.update(projectId, name, {
        description: input.description,
      });
      if (!updated) return null;
      return publish(await hydrateProjectSkill(deps.fileService, updated));
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

    return publish(await hydrateProjectSkill(deps.fileService, updated));
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
      return update(projectId, name, { description: input.description });
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
    return publish(refreshed);
  };

  const remove = async (projectId: string, name: string) => {
    const existing = await deps.skillsDBService.getByName(projectId, name);
    if (!existing) return false;
    const removed = await deps.skillsDBService.remove(projectId, name);
    if (removed) deps.eventBus.emit("skills", "delete", { id: existing.id });
    return removed;
  };

  return {
    list,
    query,
    getByName,
    create,
    update,
    setPreference,
    remove,
  };
};
