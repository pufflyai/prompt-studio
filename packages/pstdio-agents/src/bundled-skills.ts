import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const SKILLS_DIR = join(import.meta.dirname, "../files/skills");
const SKILL_FILE_SUFFIX = "/SKILL.md";

const parseFrontmatter = (content: string) => {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match?.[1]) return { name: "", description: "", version: "" };

  const lines = match[1].split("\n");
  let name = "";
  let description = "";
  let version = "";

  for (const line of lines) {
    const [key, ...rest] = line.split(":");
    const value = rest
      .join(":")
      .trim()
      .replace(/^"(.*)"$/, "$1");
    if (key?.trim() === "name") name = value;
    if (key?.trim() === "description") description = value;
    if (key?.trim() === "- version") version = value;
  }

  return { name, description, version };
};

export type BundledSkill = {
  name: string;
  description: string;
  version: string;
  content: string;
};

type EmbeddedFile = Blob & { name: string };

const getEmbeddedFiles = () => {
  const files = (Bun as Record<string, unknown>).embeddedFiles;
  return Array.isArray(files) ? (files as EmbeddedFile[]) : [];
};

const resolveEmbeddedSkillName = (fileName: string) => {
  if (!fileName.endsWith(SKILL_FILE_SUFFIX)) return null;
  const marker = "/files/skills/";
  const markerIndex = fileName.indexOf(marker);
  if (markerIndex < 0) return null;

  const relativePath = fileName.slice(markerIndex + marker.length, -SKILL_FILE_SUFFIX.length);
  const [skillName] = relativePath.split("/");
  return skillName || null;
};

const loadEmbeddedSkills = async () => {
  const embeddedFiles = getEmbeddedFiles();
  const files = embeddedFiles
    .map((file) => {
      const skillName = resolveEmbeddedSkillName(file.name);
      if (!skillName) return null;
      return { skillName, file };
    })
    .filter((entry) => entry !== null)
    .sort((a, b) => a.skillName.localeCompare(b.skillName));

  if (files.length === 0) return null;

  return Promise.all(
    files.map(async ({ skillName, file }) => {
      const content = await file.text();
      const { name, description, version } = parseFrontmatter(content);
      return { name: name || skillName, description, version, content };
    }),
  );
};

const loadFilesystemSkills = () => {
  const entries = readdirSync(SKILLS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .sort((a, b) => a.name.localeCompare(b.name));

  return entries.map((entry) => {
    const content = readFileSync(join(SKILLS_DIR, entry.name, "SKILL.md"), "utf8");
    const { name, description, version } = parseFrontmatter(content);
    return { name: name || entry.name, description, version, content };
  });
};

export const getBundledSkills = async () => {
  return (await loadEmbeddedSkills()) ?? loadFilesystemSkills();
};
