import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { findAgent } from "pstdio-agents";
import type { RouteDeps } from "../deps";
import { installSkillToRepo } from "./install-skill-to-repo";

type Deps = Pick<RouteDeps, "projectService" | "repoService" | "skillService" | "agentConfigService" | "fileService">;

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
    let content: string | null = null;

    for (const repo of repos) {
      for (const agent of agents) {
        if (isSkillInstalled(repo.path, agent.agent_id, skill.name)) continue;

        if (content === null) {
          const file = await deps.fileService.get(skill.file_id);
          if (!file) break;
          content = await readFile(file.storage_path, "utf8");
        }

        installSkillToRepo(repo.path, agent.agent_id, skill.name, content);
      }
    }
  }
};

export const ensureSkillsInstalled = async (deps: Deps) => {
  const [projects, agents] = await Promise.all([deps.projectService.list(), deps.agentConfigService.list()]);
  if (projects.length === 0 || agents.length === 0) return;

  for (const project of projects) {
    await installMissingSkillsForProject(deps, project.id, agents);
  }
};
