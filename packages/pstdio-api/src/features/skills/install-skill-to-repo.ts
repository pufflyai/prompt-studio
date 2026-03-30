import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { homedir as defaultHomedir } from "node:os";
import { join } from "node:path";
import { findAgent } from "pstdio-agents";
import { setupInstalledAgents } from "../agents/setup-installed-agents";
import type { RouteDeps } from "../deps";

type InstallSkillOptions = {
  homedir?: string;
  overwrite?: boolean;
};

export const installSkillToRepo = (
  repoPath: string,
  agentId: string,
  skillName: string,
  content: string,
  options?: InstallSkillOptions,
) => {
  const agent = findAgent(agentId);
  if (!agent) return;

  const dir = join(repoPath, agent.skillsDir, skillName);
  const hasLocalCopy = existsSync(dir);
  if (hasLocalCopy && !options?.overwrite) return;

  const homedir = options?.homedir ?? defaultHomedir();
  const globalDir = join(homedir, agent.globalSkillsDir, skillName);
  if (existsSync(globalDir) && !hasLocalCopy) return;

  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "SKILL.md"), content, "utf8");
};

const resolveTargetAgents = async (deps: Pick<RouteDeps, "agentConfigService" | "agentRegistry" | "eventBus">) => {
  const configured = await deps.agentConfigService.list();
  if (configured.length > 0) return configured;

  return setupInstalledAgents(deps);
};

export const installProjectSkillsToRepo = async (
  deps: Pick<RouteDeps, "skillService" | "agentConfigService" | "fileService" | "agentRegistry" | "eventBus">,
  input: { projectId: string; repoPath: string },
) => {
  const [skills, agents] = await Promise.all([deps.skillService.list(input.projectId), resolveTargetAgents(deps)]);

  for (const skill of skills) {
    const file = await deps.fileService.get(skill.file_id);
    if (!file) continue;

    const content = await readFile(file.storage_path, "utf8");
    for (const agent of agents) {
      installSkillToRepo(input.repoPath, agent.agent_id, skill.name, content);
    }
  }
};
