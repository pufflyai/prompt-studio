import { mkdirSync, writeFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { findAgent } from "pstdio-agents";
import type { RouteDeps } from "../deps";

export const installSkillToRepo = (repoPath: string, agentId: string, skillName: string, content: string) => {
  const agent = findAgent(agentId);
  if (!agent) return;

  const dir = join(repoPath, agent.skillsDir, skillName);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "SKILL.md"), content, "utf8");
};

export const installProjectSkillsToRepo = async (
  deps: Pick<RouteDeps, "skillsDbService" | "agentConfigsService" | "filesService">,
  input: { projectId: string; repoPath: string },
) => {
  const [skills, agents] = await Promise.all([
    deps.skillsDbService.list(input.projectId),
    deps.agentConfigsService.list(),
  ]);

  for (const skill of skills) {
    const file = await deps.filesService.get(skill.file_id);
    if (!file) continue;

    const content = await readFile(file.storage_path, "utf8");
    for (const agent of agents) {
      installSkillToRepo(input.repoPath, agent.agent_id, skill.name, content);
    }
  }
};
