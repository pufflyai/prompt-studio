import { existsSync, readdirSync, readFileSync } from "node:fs";
import { homedir as defaultHomedir } from "node:os";
import { join, relative } from "node:path";
import { findAgent, type KnownAgent } from "pstdio-agents";

type SkillFile = {
  path: string;
  content: string;
  encoding: "utf8";
};

type Skill = {
  name: string;
  description: string;
  files: SkillFile[];
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

  const readSkillFiles = (rootPath: string, baseRoot = rootPath): SkillFile[] => {
    const entries = readdirSync(rootPath, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name));
    const files: SkillFile[] = [];

    for (const entry of entries) {
      const entryPath = join(rootPath, entry.name);

      if (entry.isDirectory()) {
        files.push(...readSkillFiles(entryPath, baseRoot));
        continue;
      }

      if (!entry.isFile()) continue;

      files.push({
        path: relative(baseRoot, entryPath).replaceAll("\\", "/"),
        content: readFileSync(entryPath, "utf8"),
        encoding: "utf8",
      });
    }

    return files.sort((a, b) => {
      if (a.path === "SKILL.md") return -1;
      if (b.path === "SKILL.md") return 1;
      return a.path.localeCompare(b.path);
    });
  };

  return readdirSync(skillsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const skillRoot = join(skillsDir, entry.name);
      const skillMdPath = join(skillRoot, "SKILL.md");
      if (!existsSync(skillMdPath)) return null;

      const files = readSkillFiles(skillRoot);
      const skillFile = files.find((file) => file.path === "SKILL.md");
      const frontmatter = parseFrontmatter(skillFile?.content ?? "");

      return {
        name: frontmatter.name || entry.name,
        description: frontmatter.description,
        files,
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
