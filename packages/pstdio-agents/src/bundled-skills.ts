import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const SKILLS_DIR = join(import.meta.dirname, "../files/skills");

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

export type BundledSkill = {
  name: string;
  description: string;
  content: string;
};

export const getBundledSkills = (): BundledSkill[] => {
  const entries = readdirSync(SKILLS_DIR, { withFileTypes: true }).filter((e) => e.isDirectory());

  return entries.map((entry) => {
    const skillPath = join(SKILLS_DIR, entry.name, "SKILL.md");
    const content = readFileSync(skillPath, "utf8");
    const { name, description } = parseFrontmatter(content);
    return { name: name || entry.name, description, content };
  });
};
