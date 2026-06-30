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

const catalogSkillFile = (files: SkillFile[]) => files.find((file) => file.path === "SKILL.md");

const readInstalledVersion = (skillFilePath: string) => parseSkillVersion(readFileSync(skillFilePath, "utf8")) || null;

// Unversioned catalog skills can't be compared by version, so fall back to file content:
// out of date when any catalog file is missing from, or differs in, the installed copy.
const installedMatchesCatalog = (skillDir: string, files: SkillFile[]) =>
  files.every((file) => {
    const filePath = join(skillDir, file.path);
    return existsSync(filePath) && readFileSync(filePath, "utf8") === file.content;
  });

// A versioned skill is "out of date" only when its installed SKILL.md version differs from
// the catalog version — comparing content would flag cosmetic drift (whitespace, reordered
// metadata) even when versions match. A skill with no `version:` metadata has no version to
// compare, so it falls back to content comparison and real edits still surface an update.
export const getSkillInstallStatus = async (deps: Deps, input: SkillInstallStatusInput) => {
  const [repos, agents] = await Promise.all([
    deps.repoService.listByProject(input.projectId),
    listSkillAgents(deps.harnessRegistry, { projectId: input.projectId }),
  ]);

  const expectedVersion = parseSkillVersion(catalogSkillFile(input.files)?.content ?? "");
  const installedAgents: string[] = [];
  const outdatedAgents: string[] = [];
  const agentInstallations: SkillAgentInstallation[] = [];

  for (const agent of agents) {
    let installedVersion: string | null = null;
    let installedDir: string | null = null;
    for (const repo of repos) {
      const skillDir = join(repo.path, agent.skillsDir, input.name);
      if (!existsSync(join(skillDir, "SKILL.md"))) continue;
      installedDir = installedDir ?? skillDir;
      installedVersion = installedVersion ?? readInstalledVersion(join(skillDir, "SKILL.md"));
    }
    if (!installedDir) continue;

    const outdated = expectedVersion
      ? installedVersion !== expectedVersion
      : !installedMatchesCatalog(installedDir, input.files);
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
