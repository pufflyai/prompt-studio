import { existsSync } from "node:fs";
import { join } from "node:path";
import { findAgent } from "pstdio-api-contracts/known-agents";
import type { SkillsRouteDeps } from "./deps";
import { installSkillToRepo } from "./install-skill-to-repo";

type Deps = Pick<
  SkillsRouteDeps,
  "projectService" | "repoService" | "skillService" | "agentConfigService" | "fileService"
>;

const isSkillInstalled = (repoPath: string, agentId: string, skillName: string) => {
  const agent = findAgent(agentId);
  if (!agent) return true;
  return existsSync(join(repoPath, agent.skillsDir, skillName, "SKILL.md"));
};

const installMissingSkillsForProject = async (deps: Deps, projectId: string, agents: { agent_id: string }[]) => {
  const [repos, skills] = await Promise.all([
    deps.repoService.listByProject(projectId),
    deps.skillService.list(projectId),
  ]);

  for (const skill of skills) {
    if (skill.files.length === 0) continue;

    for (const repo of repos) {
      for (const agent of agents) {
        if (isSkillInstalled(repo.path, agent.agent_id, skill.name)) continue;

        installSkillToRepo(repo.path, agent.agent_id, skill.name, skill.files);
      }
    }
  }
};

export const ensureSkillsInstalled = async (deps: Deps) => {
  const [projects, agents] = await Promise.all([deps.projectService.list(), deps.agentConfigService.list()]);
  if (projects.length === 0) return;

  for (const project of projects) {
    if (agents.length === 0) continue;
    await installMissingSkillsForProject(deps, project.id, agents);
  }
};
