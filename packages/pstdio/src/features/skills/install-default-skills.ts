import { cpSync, existsSync, readdirSync } from "node:fs";
import { homedir as defaultHomedir } from "node:os";
import { join } from "node:path";
import { findAgent } from "pstdio-agents";
import { listAgents } from "@/features/agents/api/list-agents";
import { API_URL } from "@/features/api-url";

const SKILLS_SOURCE = join(import.meta.dirname, "../../../files/skills");

const getBundledSkillNames = () =>
  readdirSync(SKILLS_SOURCE, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);

type InstallSkillsOptions = {
  root: string;
  agentId: string;
  global?: boolean;
  homedir?: string;
};

export const installSkillsForAgent = (options: InstallSkillsOptions) => {
  const { root, agentId, global: isGlobal = false, homedir = defaultHomedir() } = options;
  const agent = findAgent(agentId);
  if (!agent) return [];

  const targetDir = isGlobal ? join(homedir, agent.globalSkillsDir) : join(root, agent.skillsDir);

  const skillNames = getBundledSkillNames();
  const installed: string[] = [];

  for (const name of skillNames) {
    const dest = join(targetDir, name);
    if (existsSync(dest)) continue;

    cpSync(join(SKILLS_SOURCE, name), dest, { recursive: true });
    installed.push(name);
  }

  return installed;
};

export const installDefaultSkills = async (root: string, baseUrl = API_URL, homedir = defaultHomedir()) => {
  const configured = await listAgents(baseUrl);
  if (configured.length === 0) return;

  const skillNames = getBundledSkillNames();

  for (const { agent_id } of configured) {
    const agent = findAgent(agent_id);
    if (!agent) continue;

    const localDir = join(root, agent.skillsDir);
    const globalDir = join(homedir, agent.globalSkillsDir);

    for (const name of skillNames) {
      const localDest = join(localDir, name);
      if (existsSync(localDest)) continue;

      // Skip local install if skill exists globally
      if (existsSync(join(globalDir, name))) continue;

      cpSync(join(SKILLS_SOURCE, name), localDest, { recursive: true });
    }
  }
};
