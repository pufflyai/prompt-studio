import { existsSync } from "node:fs";
import { join } from "node:path";
import type { SkillFile } from "pstdio-api-contracts";
import { listSkillAgents } from "../harnesses/skill-agents";
import type { SkillsRouteDeps } from "./deps";
import { hasExpectedSkillTree } from "./install-skill-to-repo";

type Deps = Pick<SkillsRouteDeps, "harnessRegistry" | "repoService">;

type SkillInstallStatusInput = {
  files: SkillFile[];
  name: string;
  projectId: string;
};

export const getSkillInstallStatus = async (deps: Deps, input: SkillInstallStatusInput) => {
  const [repos, agents] = await Promise.all([
    deps.repoService.listByProject(input.projectId),
    listSkillAgents(deps.harnessRegistry, { projectId: input.projectId }),
  ]);

  const installedAgents = new Set<string>();
  const outdatedAgents = new Set<string>();

  for (const agent of agents) {
    for (const repo of repos) {
      const skillDir = join(repo.path, agent.skillsDir, input.name);
      if (!existsSync(join(skillDir, "SKILL.md"))) continue;

      installedAgents.add(agent.id);
      if (!hasExpectedSkillTree(skillDir, input.files)) {
        outdatedAgents.add(agent.id);
      }
    }
  }

  return {
    installed_agents: [...installedAgents],
    outdated_agents: [...outdatedAgents],
  };
};
