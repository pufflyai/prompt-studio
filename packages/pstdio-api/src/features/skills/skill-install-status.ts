import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import type { SkillAgentInstallation, SkillFile } from "pstdio-api-contracts";
import { listSkillAgents } from "../harnesses/skill-agents";
import type { SkillsRouteDeps } from "./deps";

type Deps = Pick<SkillsRouteDeps, "harnessRegistry" | "repoService">;

type SkillInstallStatusInput = {
  files: SkillFile[];
  name: string;
  projectId: string;
};

const sortSkillFiles = (files: SkillFile[]) =>
  [...files].sort((a, b) => {
    if (a.path === "SKILL.md") return -1;
    if (b.path === "SKILL.md") return 1;
    return a.path.localeCompare(b.path);
  });

const readSkillTree = (rootPath: string, currentPath = rootPath): SkillFile[] => {
  const entries = readdirSync(currentPath, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name));
  const files: SkillFile[] = [];

  for (const entry of entries) {
    const entryPath = join(currentPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...readSkillTree(rootPath, entryPath));
      continue;
    }
    if (!entry.isFile()) continue;

    files.push({
      path: relative(rootPath, entryPath).replaceAll("\\", "/"),
      content: readFileSync(entryPath, "utf8"),
      encoding: "utf8",
    });
  }

  return sortSkillFiles(files);
};

const hasExpectedSkillTree = (dir: string, files: SkillFile[]) => {
  const actual = readSkillTree(dir);
  const expected = sortSkillFiles(files);
  if (actual.length !== expected.length) return false;

  return expected.every((file, index) => {
    const installed = actual[index];
    return installed?.path === file.path && installed.content === file.content && installed.encoding === file.encoding;
  });
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
