import { existsSync } from "node:fs";
import { join } from "node:path";
import { listSkillAgents, type SkillAgent } from "../harnesses/skill-agents";
import type { SkillsRouteDeps } from "./deps";
import { installSkillToRepo } from "./install-skill-to-repo";

type Deps = Pick<
  SkillsRouteDeps,
  "projectService" | "repoService" | "skillService" | "harnessRegistry" | "fileService"
>;

const isSkillInstalled = (repoPath: string, agent: SkillAgent, skillName: string) =>
  existsSync(join(repoPath, agent.skillsDir, skillName, "SKILL.md"));

const installMissingSkillsForProject = async (deps: Deps, projectId: string, agents: SkillAgent[]) => {
  const [repos, skills] = await Promise.all([
    deps.repoService.listByProject(projectId),
    deps.skillService.list(projectId),
  ]);

  for (const skill of skills) {
    if (skill.files.length === 0) continue;

    for (const repo of repos) {
      for (const agent of agents) {
        if (isSkillInstalled(repo.path, agent, skill.name)) continue;

        installSkillToRepo(repo.path, agent, skill.name, skill.files);
      }
    }
  }
};

export const ensureSkillsInstalled = async (deps: Deps) => {
  const projects = await deps.projectService.list();

  for (const project of projects) {
    const agents = await listSkillAgents(deps.harnessRegistry, { projectId: project.id });
    if (agents.length === 0) continue;

    await installMissingSkillsForProject(deps, project.id, agents);
  }
};
