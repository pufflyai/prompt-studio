import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { SkillAgentInstallation, SkillFile } from "pstdio-api-contracts";
import { listSkillAgents } from "../harnesses/skill-agents";
import type { SkillsRouteDeps } from "./deps";

type Deps = Pick<SkillsRouteDeps, "harnessRegistry" | "workspaceService">;

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

// A single installed copy is out of date when its SKILL.md version differs from the catalog —
// or, for an unversioned catalog skill, when its files differ from the catalog content.
// Comparing content for versioned skills would flag cosmetic drift (whitespace, reordered
// metadata) even when versions match, so version wins whenever the catalog declares one.
const skillCopyOutdated = (input: {
  expectedVersion: string;
  installedVersion: string | null;
  skillDir: string;
  files: SkillFile[];
}) =>
  input.expectedVersion
    ? input.installedVersion !== input.expectedVersion
    : !installedMatchesCatalog(input.skillDir, input.files);

export const getSkillInstallStatus = async (deps: Deps, input: SkillInstallStatusInput) => {
  const [workspace, agents] = await Promise.all([
    deps.workspaceService.getDefault(input.projectId),
    listSkillAgents(deps.harnessRegistry, { projectId: input.projectId }),
  ]);

  const expectedVersion = parseSkillVersion(catalogSkillFile(input.files)?.content ?? "");
  const installedAgents: string[] = [];
  const outdatedAgents: string[] = [];
  const agentInstallations: SkillAgentInstallation[] = [];

  const projectFolder = workspace?.root_path;
  if (!projectFolder) return { installed_agents: [], outdated_agents: [], agent_installations: [] };
  for (const agent of agents) {
    const skillDir = join(projectFolder, agent.skillsDir, input.name);
    if (!existsSync(join(skillDir, "SKILL.md"))) continue;
    const installedVersion = readInstalledVersion(join(skillDir, "SKILL.md"));
    const outdated = skillCopyOutdated({ expectedVersion, installedVersion, skillDir, files: input.files });

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
