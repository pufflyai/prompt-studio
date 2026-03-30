import { existsSync, readdirSync, readFileSync } from "node:fs";
import { homedir as defaultHomedir } from "node:os";
import { join } from "node:path";
import { findAgent, type KnownAgent } from "pstdio-agents";

type Skill = {
  name: string;
  description: string;
  path: string;
};

type SkillsServiceOptions = {
  homedir?: string;
};

const parseFrontmatter = (content: string) => {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match?.[1]) return { name: "", description: "" };

  const lines = match[1].split("\n");
  let name = "";
  let description = "";

  for (const line of lines) {
    const [key, ...rest] = line.split(":");
    const value = rest
      .join(":")
      .trim()
      .replace(/^"(.*)"$/, "$1");
    if (key?.trim() === "name") name = value;
    if (key?.trim() === "description") description = value;
  }

  return { name, description };
};

const readSkillsFromDir = (skillsDir: string): Skill[] => {
  if (!existsSync(skillsDir)) return [];

  return readdirSync(skillsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const skillMdPath = join(skillsDir, entry.name, "SKILL.md");
      if (!existsSync(skillMdPath)) return null;

      const content = readFileSync(skillMdPath, "utf8");
      const frontmatter = parseFrontmatter(content);

      return {
        name: frontmatter.name || entry.name,
        description: frontmatter.description,
        path: join(skillsDir, entry.name),
      };
    })
    .filter((skill): skill is Skill => skill !== null);
};

const resolveAgent = (agentId: string): KnownAgent | null => findAgent(agentId);

export const createSkillsStorageService = (options?: SkillsServiceOptions) => {
  const home = options?.homedir ?? defaultHomedir();

  const listProjectSkills = (repoPath: string, agentId: string) => {
    const agent = resolveAgent(agentId);
    if (!agent) return [];

    const skillsDir = join(repoPath, agent.skillsDir);
    return readSkillsFromDir(skillsDir);
  };

  const listGlobalSkills = (agentId: string) => {
    const agent = resolveAgent(agentId);
    if (!agent) return [];

    const skillsDir = join(home, agent.globalSkillsDir);
    return readSkillsFromDir(skillsDir);
  };

  return { listProjectSkills, listGlobalSkills };
};
