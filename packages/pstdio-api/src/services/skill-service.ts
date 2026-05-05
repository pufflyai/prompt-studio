import { readFile } from "node:fs/promises";
import type { SkillFile } from "pstdio-api-contracts";
import type { createSkillsDBService } from "pstdio-db";
import type { createSkillsStorageService } from "pstdio-storage";
import type { createFileService } from "./file-service";

type DbSkill = Awaited<ReturnType<ReturnType<typeof createSkillsDBService>["getByName"]>>;

type SkillRecord = {
  id: string;
  project_id: string;
  name: string;
  description: string;
  files: SkillFile[];
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type SkillServiceDeps = {
  skillsDBService: ReturnType<typeof createSkillsDBService>;
  skillsStorageService: ReturnType<typeof createSkillsStorageService>;
  fileService: ReturnType<typeof createFileService>;
};

const readSkillFileContent = async (fileService: SkillServiceDeps["fileService"], fileId: string): Promise<string> => {
  const file = await fileService.get(fileId);
  if (!file) return "";
  return readFile(file.storage_path, "utf8");
};

const hydrateSkill = async (
  fileService: SkillServiceDeps["fileService"],
  skill: NonNullable<DbSkill>,
): Promise<SkillRecord> => {
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
    name: skill.name,
    description: skill.description,
    files,
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

export const createSkillService = (deps: SkillServiceDeps) => {
  const list = async (projectId: string) => {
    const skills = await deps.skillsDBService.list(projectId);
    return Promise.all(skills.map((skill) => hydrateSkill(deps.fileService, skill)));
  };

  const getByName = async (projectId: string, name: string) => {
    const skill = await deps.skillsDBService.getByName(projectId, name);
    if (!skill) return null;
    return hydrateSkill(deps.fileService, skill);
  };

  const create = async (input: { project_id: string; name: string; description: string; files: SkillFile[] }) => {
    const ingested = await ingestSkillFiles(deps.fileService, input.project_id, input.files);
    const created = await deps.skillsDBService.create({
      project_id: input.project_id,
      name: input.name,
      description: input.description,
      files: ingested,
    });
    return hydrateSkill(deps.fileService, created);
  };

  const update = async (projectId: string, name: string, input: { description?: string; files?: SkillFile[] }) => {
    if (!input.files) {
      const updated = await deps.skillsDBService.update(projectId, name, {
        description: input.description,
      });
      if (!updated) return null;
      return hydrateSkill(deps.fileService, updated);
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

    return hydrateSkill(deps.fileService, updated);
  };

  const remove = (projectId: string, name: string) => deps.skillsDBService.remove(projectId, name);

  return {
    ...deps.skillsStorageService,
    list,
    getByName,
    create,
    update,
    remove,
  };
};
