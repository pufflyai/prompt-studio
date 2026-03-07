import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { createReposService } from "pstdio-db";

type ChangelogErrorCode = "CHANGELOG_NOT_FOUND" | "CHANGELOG_PARSE_ERROR";

export type ChangelogChange = {
  title: string;
  description?: string;
  link?: string;
};

export type ChangelogEntry = {
  version: string;
  date: string;
  title: string;
  tags?: string[];
  image?: string;
  description?: string;
  changes?: ChangelogChange[];
};

export type Changelog = {
  title: string;
  description?: string;
  entries: ChangelogEntry[];
};

const CHANGELOG_DIR = join(".pstdio", "changelog");
const CHANGELOG_FILE = "changelog.md";

const createChangelogError = (code: ChangelogErrorCode, message: string) => Object.assign(new Error(message), { code });

const parseMetadataField = (line: string) => {
  const match = line.match(/^\*\*(\w+):\*\*\s*(.+)$/);
  if (!match) return null;
  return { key: match[1].toLowerCase(), value: match[2].trim() };
};

const parseChange = (line: string): ChangelogChange => {
  const cleaned = line.replace(/^-\s*/, "");

  const linkMatch = cleaned.match(/\[([^\]]+)\]\(([^)]+)\)/);
  const withoutLink = linkMatch ? cleaned.replace(linkMatch[0], "").trim() : cleaned;

  const parts = withoutLink.split(" — ");
  const rawTitle = parts[0].replace(/\*\*/g, "").trim();
  const description =
    parts.length > 1
      ? parts
          .slice(1)
          .join(" — ")
          .replace(/[.,]\s*$/, "")
          .trim()
      : undefined;

  const change: ChangelogChange = { title: rawTitle };
  if (description) change.description = description;
  if (linkMatch) change.link = linkMatch[2];

  return change;
};

const parseHeader = (markdown: string) => {
  const lines = markdown.split("\n");
  let title = "Changelog";
  let description: string | undefined;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("# ")) {
      title = trimmed.slice(2).trim();
      continue;
    }
    if (trimmed === "" || trimmed === "---") continue;
    if (trimmed.startsWith("## ")) break;
    description = trimmed;
    break;
  }

  return { title, description };
};

const parseEntry = (block: string): ChangelogEntry | null => {
  const lines = block.split("\n");
  let version = "";
  let date = "";
  let title = "";
  let tags: string[] | undefined;
  let image: string | undefined;
  let description: string | undefined;
  const changes: ChangelogChange[] = [];

  let inChanges = false;

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.startsWith("## ")) {
      version = trimmed.slice(3).trim();
      continue;
    }

    if (trimmed === "### Changes") {
      inChanges = true;
      continue;
    }

    if (inChanges) {
      if (trimmed.startsWith("- ")) {
        changes.push(parseChange(trimmed));
      }
      continue;
    }

    const field = parseMetadataField(trimmed);
    if (field) {
      switch (field.key) {
        case "date":
          date = field.value;
          break;
        case "title":
          title = field.value;
          break;
        case "tags":
          tags = field.value.split(",").map((t) => t.trim());
          break;
        case "image":
          image = field.value;
          break;
      }
      continue;
    }

    if (trimmed && !description && version) {
      description = trimmed;
    }
  }

  if (!version) return null;

  const entry: ChangelogEntry = { version, date, title };
  if (tags?.length) entry.tags = tags;
  if (image) entry.image = image;
  if (description) entry.description = description;
  if (changes.length) entry.changes = changes;

  return entry;
};

export const parseChangelog = (markdown: string): Changelog => {
  const { title, description } = parseHeader(markdown);
  const blocks = markdown.split(/^---$/m).slice(1);
  const entries: ChangelogEntry[] = [];

  for (const block of blocks) {
    const entry = parseEntry(block);
    if (entry) entries.push(entry);
  }

  return { title, description, entries };
};

export const isChangelogServiceError = (value: unknown): value is Error & { code: ChangelogErrorCode } =>
  value instanceof Error && "code" in value && typeof value.code === "string";

export const createChangelogService = (reposService: ReturnType<typeof createReposService>) => {
  const resolveChangelogDir = async (projectId: string) => {
    const repos = await reposService.listByProject(projectId);
    if (repos.length === 0) {
      throw createChangelogError("CHANGELOG_NOT_FOUND", `No repo linked to project ${projectId}.`);
    }
    return join(repos[0].path, CHANGELOG_DIR);
  };

  const getChangelog = async (projectId: string): Promise<Changelog> => {
    const changelogDir = await resolveChangelogDir(projectId);
    const filePath = join(changelogDir, CHANGELOG_FILE);

    if (!existsSync(filePath)) {
      throw createChangelogError("CHANGELOG_NOT_FOUND", "Changelog not found at .pstdio/changelog/changelog.md");
    }

    const markdown = readFileSync(filePath, "utf8");
    return parseChangelog(markdown);
  };

  return { getChangelog };
};
