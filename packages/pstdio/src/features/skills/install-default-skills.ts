import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { homedir as defaultHomedir } from "node:os";
import { join } from "node:path";
import { findAgent } from "pstdio-agents";
import { listAgents } from "@/features/agents/api/list-agents";
import { API_URL } from "@/features/api-url";
import { listSkillsWithContent } from "./api/list-skills";

type InstallSkillsOptions = {
  root: string;
  agentId: string;
  baseUrl: string;
  projectId?: string;
  global?: boolean;
  homedir?: string;
};

export const installSkillsForAgent = async (options: InstallSkillsOptions) => {
  const { root, agentId, baseUrl, projectId, global: isGlobal = false, homedir = defaultHomedir() } = options;
  const agent = findAgent(agentId);
  if (!agent) return [];
  if (!projectId) return [];

  const targetDir = isGlobal ? join(homedir, agent.globalSkillsDir) : join(root, agent.skillsDir);

  const skills = await listSkillsWithContent(baseUrl, projectId);
  const installed: string[] = [];

  for (const skill of skills) {
    const dest = join(targetDir, skill.name);
    if (existsSync(dest)) continue;

    mkdirSync(dest, { recursive: true });
    writeFileSync(join(dest, "SKILL.md"), skill.content, "utf8");
    installed.push(skill.name);
  }

  return installed;
};

export const removeBundledSkillsForAgent = async (
  root: string,
  agentId: string,
  baseUrl: string,
  projectId: string,
) => {
  const agent = findAgent(agentId);
  if (!agent) return [];

  const skillsDir = join(root, agent.skillsDir);
  const skills = await listSkillsWithContent(baseUrl, projectId);
  const removed: string[] = [];

  for (const skill of skills) {
    const dest = join(skillsDir, skill.name);
    if (!existsSync(dest)) continue;

    rmSync(dest, { recursive: true, force: true });
    removed.push(skill.name);
  }

  return removed;
};

export const installDefaultSkills = async (
  root: string,
  projectId: string,
  baseUrl = API_URL,
  homedir = defaultHomedir(),
) => {
  const configured = await listAgents(baseUrl);
  if (configured.length === 0) return;

  const skills = await listSkillsWithContent(baseUrl, projectId);

  for (const { agent_id } of configured) {
    const agent = findAgent(agent_id);
    if (!agent) continue;

    const localDir = join(root, agent.skillsDir);
    const globalDir = join(homedir, agent.globalSkillsDir);

    for (const skill of skills) {
      const localDest = join(localDir, skill.name);
      if (existsSync(localDest)) continue;
      if (existsSync(join(globalDir, skill.name))) continue;

      mkdirSync(localDest, { recursive: true });
      writeFileSync(join(localDest, "SKILL.md"), skill.content, "utf8");
    }
  }
};
