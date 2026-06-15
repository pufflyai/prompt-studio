import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { SkillAgentInstallation, SkillFile } from "pstdio-api-contracts";
import { listSkillAgents } from "../harnesses/skill-agents";
import type { SkillsRouteDeps } from "./deps";
import { hasExpectedSkillTree } from "./install-skill-to-repo";

type Deps = Pick<SkillsRouteDeps, "harnessRegistry" | "repoService">;

type SkillInstallStatusInput = {
  files: SkillFile[];
  name: string;
  projectId: string;
};

const agentName = (agentId: string) => agentId.split(".").at(-1) ?? agentId;

const parseSkillVersion = (content: string) => {
  const match = content.match(/^\s*-?\s*version:\s*(.+)\s*$/m);
  return match?.[1]?.trim() ?? "";
};

const readInstalledVersion = (skillFilePath: string) => {
  const version = parseSkillVersion(readFileSync(skillFilePath, "utf8"));
  return version || null;
};

export const getSkillInstallStatus = async (deps: Deps, input: SkillInstallStatusInput) => {
  const [repos, agents] = await Promise.all([
    deps.repoService.listByProject(input.projectId),
    listSkillAgents(deps.harnessRegistry, { projectId: input.projectId }),
  ]);

  const installedAgents = new Set<string>();
  const outdatedAgents = new Set<string>();
  const installations = new Map<string, SkillAgentInstallation>();

  for (const agent of agents) {
    for (const repo of repos) {
      const skillDir = join(repo.path, agent.skillsDir, input.name);
      const skillFilePath = join(skillDir, "SKILL.md");
      if (!existsSync(skillFilePath)) continue;

      installedAgents.add(agent.id);
      const installedVersion = readInstalledVersion(skillFilePath);
      const installation = installations.get(agent.id) ?? {
        agent_id: agent.id,
        agent_name: agentName(agent.id),
        installed_version: installedVersion,
        outdated: false,
      };
      if (!installation.installed_version && installedVersion) {
        installation.installed_version = installedVersion;
      }
      if (!hasExpectedSkillTree(skillDir, input.files)) {
        outdatedAgents.add(agent.id);
        installation.outdated = true;
      }
      installations.set(agent.id, installation);
    }
  }

  return {
    installed_agents: [...installedAgents],
    outdated_agents: [...outdatedAgents],
    agent_installations: [...installations.values()],
  };
};
