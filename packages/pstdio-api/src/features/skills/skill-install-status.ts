import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { SkillAgentInstallation, SkillFile } from "pstdio-api-contracts";
import { listSkillAgents } from "../harnesses/skill-agents";
import type { SkillsRouteDeps } from "./deps";

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

const catalogVersion = (files: SkillFile[]) =>
  parseSkillVersion(files.find((file) => file.path === "SKILL.md")?.content ?? "");

const readInstalledVersion = (skillFilePath: string) => parseSkillVersion(readFileSync(skillFilePath, "utf8")) || null;

// A skill is "out of date" only when its installed SKILL.md version differs from the
// catalog version. Comparing file content instead would flag cosmetic drift (whitespace,
// reordered metadata) as outdated even when the versions match.
export const getSkillInstallStatus = async (deps: Deps, input: SkillInstallStatusInput) => {
  const [repos, agents] = await Promise.all([
    deps.repoService.listByProject(input.projectId),
    listSkillAgents(deps.harnessRegistry, { projectId: input.projectId }),
  ]);

  const expectedVersion = catalogVersion(input.files);
  const installedAgents: string[] = [];
  const outdatedAgents: string[] = [];
  const agentInstallations: SkillAgentInstallation[] = [];

  for (const agent of agents) {
    let installedVersion: string | null = null;
    let installed = false;
    for (const repo of repos) {
      const skillFilePath = join(repo.path, agent.skillsDir, input.name, "SKILL.md");
      if (!existsSync(skillFilePath)) continue;
      installed = true;
      installedVersion = installedVersion ?? readInstalledVersion(skillFilePath);
    }
    if (!installed) continue;

    const outdated = Boolean(expectedVersion) && installedVersion !== expectedVersion;
    installedAgents.push(agent.id);
    if (outdated) outdatedAgents.push(agent.id);
    agentInstallations.push({
      agent_id: agent.id,
      agent_name: agentName(agent.id),
      installed_version: installedVersion,
      outdated,
    });
  }

  return {
    installed_agents: installedAgents,
    outdated_agents: outdatedAgents,
    agent_installations: agentInstallations,
  };
};
