import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { SkillAgentInstallation } from "pstdio-api-contracts";
import { listSkillAgents } from "../harnesses/skill-agents";
import type { SkillsRouteDeps } from "./deps";

type Deps = Pick<SkillsRouteDeps, "harnessRegistry" | "workspaceService">;

type SkillInstallStatusInput = {
  name: string;
  projectId: string;
};

const agentName = (agentId: string) => agentId.split(".").at(-1) ?? agentId;

const parseSkillVersion = (content: string) => {
  const match = content.match(/^\s*-?\s*version:\s*(.+)\s*$/m);
  return match?.[1]?.trim() ?? "";
};

const readInstalledVersion = (skillFilePath: string) => parseSkillVersion(readFileSync(skillFilePath, "utf8")) || null;

export const getSkillInstallStatus = async (deps: Deps, input: SkillInstallStatusInput) => {
  const [workspace, agents] = await Promise.all([
    deps.workspaceService.getDefault(input.projectId),
    listSkillAgents(deps.harnessRegistry, { projectId: input.projectId }),
  ]);

  const installedAgents: string[] = [];
  const agentInstallations: SkillAgentInstallation[] = [];

  const projectFolder = workspace?.root_path;
  if (!projectFolder) return { installed_agents: [], agent_installations: [] };
  for (const agent of agents) {
    const skillFile = join(projectFolder, agent.skillsDir, input.name, "SKILL.md");
    if (!existsSync(skillFile)) continue;

    installedAgents.push(agent.id);
    agentInstallations.push({
      agent_id: agent.id,
      agent_name: agentName(agent.id),
      installed_version: readInstalledVersion(skillFile),
    });
  }

  return {
    installed_agents: installedAgents,
    agent_installations: agentInstallations,
  };
};
