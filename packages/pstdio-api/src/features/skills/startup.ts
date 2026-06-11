import { existsSync } from "node:fs";
import { join } from "node:path";
import { findAgent } from "pstdio-api-contracts/known-agents";
import { listSkillAgentIds } from "../harnesses/skill-agents";
import type { SkillsRouteDeps } from "./deps";
import { installSkillToRepo } from "./install-skill-to-repo";

type Deps = Pick<
  SkillsRouteDeps,
  "projectService" | "repoService" | "skillService" | "harnessRegistry" | "fileService"
>;

const isSkillInstalled = (repoPath: string, agentId: string, skillName: string) => {
  const agent = findAgent(agentId);
  if (!agent) return true;
  return existsSync(join(repoPath, agent.skillsDir, skillName, "SKILL.md"));
};

const installMissingSkillsForProject = async (deps: Deps, projectId: string, agentIds: string[]) => {
  const [repos, skills] = await Promise.all([
    deps.repoService.listByProject(projectId),
    deps.skillService.list(projectId),
  ]);

  for (const skill of skills) {
    if (skill.files.length === 0) continue;

    for (const repo of repos) {
      for (const agentId of agentIds) {
        if (isSkillInstalled(repo.path, agentId, skill.name)) continue;

        installSkillToRepo(repo.path, agentId, skill.name, skill.files);
      }
    }
  }
};

export const ensureSkillsInstalled = async (deps: Deps) => {
  const [projects, agentIds] = await Promise.all([deps.projectService.list(), listSkillAgentIds(deps.harnessRegistry)]);
  if (projects.length === 0 || agentIds.length === 0) return;

  for (const project of projects) {
    await installMissingSkillsForProject(deps, project.id, agentIds);
  }
};
