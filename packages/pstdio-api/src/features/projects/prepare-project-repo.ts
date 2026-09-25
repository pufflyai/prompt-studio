import { existsSync } from "node:fs";
import { readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { createProjectService } from "../../services/project-service";
import { installRepoDefaultExtensions, resolveDefaultExtensionsConfig } from "../extensions/default-extensions";
import { bootstrapProjectRepo } from "./bootstrap-project-repo";

export class RepoLinkConflictError extends Error {}

export const prepareProjectRepo = async (
  projectService: Pick<ReturnType<typeof createProjectService>, "get">,
  projectId: string,
  path: string,
) => {
  const configPath = join(path, ".pstdio", "config.json");
  const previous = existsSync(configPath) ? await readFile(configPath) : null;
  if (previous) {
    const existing = JSON.parse(previous.toString("utf8"));
    if (existing.project_id && existing.project_id !== projectId && (await projectService.get(existing.project_id))) {
      throw new RepoLinkConflictError(`Repo is already linked to project ${existing.project_id}`);
    }
  }

  let rollbackExtensions: (() => Promise<void>) | undefined;
  const restoreConfig = async () => {
    if (previous) await writeFile(configPath, previous);
    else if (existsSync(configPath)) await rm(configPath);
  };
  const rollback = async () => {
    const results = await Promise.allSettled([restoreConfig(), rollbackExtensions?.()]);
    for (const result of results) {
      if (result.status === "rejected") throw result.reason;
    }
  };
  try {
    await bootstrapProjectRepo(path, projectId);
    const installed = await installRepoDefaultExtensions({
      repoPath: path,
      defaultExtensions: (await resolveDefaultExtensionsConfig()).defaultExtensions,
    });
    rollbackExtensions = installed.rollback;
  } catch (error) {
    await rollback();
    throw error;
  }
  return rollback;
};
