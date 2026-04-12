import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

const SKILLS_DIR = join(import.meta.dirname, "../files/skills");
const SKILLS_MARKER = "/files/skills/";

export type SkillFile = {
  path: string;
  content: string;
  encoding: "utf8";
};

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
  files: SkillFile[];
};

type EmbeddedFile = Blob & { name: string };

const getEmbeddedFiles = () => {
  const files = (Bun as Record<string, unknown>).embeddedFiles;
  return Array.isArray(files) ? (files as EmbeddedFile[]) : [];
};

const normalizeRelativePath = (path: string) => path.replaceAll("\\", "/");

const sortSkillFiles = (files: SkillFile[]) => {
  return files.sort((a, b) => {
    if (a.path === "SKILL.md") return -1;
    if (b.path === "SKILL.md") return 1;
    return a.path.localeCompare(b.path);
  });
};

const resolveEmbeddedSkillFile = (fileName: string) => {
  const markerIndex = fileName.indexOf(SKILLS_MARKER);
  if (markerIndex < 0) return null;

  const fullRelativePath = fileName.slice(markerIndex + SKILLS_MARKER.length);
  const [skillName, ...pathParts] = fullRelativePath.split("/");
  if (!skillName || pathParts.length === 0) return null;

  return {
    skillName,
    path: normalizeRelativePath(pathParts.join("/")),
  };
};

const loadEmbeddedSkills = async () => {
  const embeddedFiles = getEmbeddedFiles();
  const entries = embeddedFiles
    .map((file) => {
      const skillFile = resolveEmbeddedSkillFile(file.name);
      if (!skillFile) return null;
      return { ...skillFile, file };
    })
    .filter((entry) => entry !== null)
    .sort((a, b) => a.skillName.localeCompare(b.skillName) || a.path.localeCompare(b.path));

  if (entries.length === 0) return null;

  const grouped = new Map<string, SkillFile[]>();

  for (const entry of entries) {
    const content = await entry.file.text();
    const file: SkillFile = { path: entry.path, content, encoding: "utf8" };
    const existing = grouped.get(entry.skillName);
    if (existing) {
      existing.push(file);
      continue;
    }

    grouped.set(entry.skillName, [file]);
  }

  const skills: BundledSkill[] = [];

  for (const [skillName, files] of grouped) {
    const sortedFiles = sortSkillFiles(files);
    const skillFile = sortedFiles.find((file) => file.path === "SKILL.md");
    if (!skillFile) continue;

    const { name, description, version } = parseFrontmatter(skillFile.content);
    skills.push({
      name: name || skillName,
      description,
      version,
      files: sortedFiles,
    });
  }

  return skills.sort((a, b) => a.name.localeCompare(b.name));
};

const readSkillTree = (rootPath: string, baseRoot = rootPath) => {
  const entries = readdirSync(rootPath, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name));
  const files: SkillFile[] = [];

  for (const entry of entries) {
    const entryPath = join(rootPath, entry.name);

    if (entry.isDirectory()) {
      files.push(...readSkillTree(entryPath, baseRoot));
      continue;
    }

    if (!entry.isFile()) continue;

    files.push({
      path: normalizeRelativePath(relative(baseRoot, entryPath)),
      content: readFileSync(entryPath, "utf8"),
      encoding: "utf8",
    });
  }

  return sortSkillFiles(files);
};

const loadFilesystemSkills = () => {
  const entries = readdirSync(SKILLS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .sort((a, b) => a.name.localeCompare(b.name));

  return entries
    .map((entry) => {
      const skillRoot = join(SKILLS_DIR, entry.name);
      const files = readSkillTree(skillRoot);
      const skillFile = files.find((file) => file.path === "SKILL.md");
      if (!skillFile) return null;

      const { name, description, version } = parseFrontmatter(skillFile.content);
      return { name: name || entry.name, description, version, files };
    })
    .filter((skill): skill is BundledSkill => skill !== null);
};

export const getBundledSkills = async () => {
  return (await loadEmbeddedSkills()) ?? loadFilesystemSkills();
};
