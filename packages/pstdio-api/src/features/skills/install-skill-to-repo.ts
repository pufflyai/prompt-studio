import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { findAgent } from "pstdio-agents";

export const installSkillToRepo = (repoPath: string, agentId: string, skillName: string, content: string) => {
  const agent = findAgent(agentId);
  if (!agent) return;

  const dir = join(repoPath, agent.skillsDir, skillName);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "SKILL.md"), content, "utf8");
};
