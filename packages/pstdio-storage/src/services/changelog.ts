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

type EntryParseState = {
  version: string;
  date: string;
  title: string;
  tags?: string[];
  image?: string;
  description?: string;
  changes: ChangelogChange[];
  inChanges: boolean;
};

const createEntryParseState = (): EntryParseState => ({
  version: "",
  date: "",
  title: "",
  tags: undefined,
  image: undefined,
  description: undefined,
  changes: [],
  inChanges: false,
});

const applyEntryMetadata = (state: EntryParseState, key: string, value: string) => {
  switch (key) {
    case "date":
      state.date = value;
      return;
    case "title":
      state.title = value;
      return;
    case "tags":
      state.tags = value.split(",").map((tag) => tag.trim());
      return;
    case "image":
      state.image = value;
      return;
    default:
      return;
  }
};

const parseEntryLine = (state: EntryParseState, trimmed: string) => {
  if (trimmed.startsWith("## ")) {
    state.version = trimmed.slice(3).trim();
    return;
  }

  if (trimmed === "### Changes") {
    state.inChanges = true;
    return;
  }

  if (state.inChanges) {
    if (trimmed.startsWith("- ")) {
      state.changes.push(parseChange(trimmed));
    }
    return;
  }

  const field = parseMetadataField(trimmed);
  if (field) {
    applyEntryMetadata(state, field.key, field.value);
    return;
  }

  if (trimmed && !state.description && state.version) {
    state.description = trimmed;
  }
};

const parseEntry = (block: string): ChangelogEntry | null => {
  const state = createEntryParseState();

  for (const line of block.split("\n")) {
    parseEntryLine(state, line.trim());
  }

  if (!state.version) return null;

  const entry: ChangelogEntry = { version: state.version, date: state.date, title: state.title };
  if (state.tags?.length) entry.tags = state.tags;
  if (state.image) entry.image = state.image;
  if (state.description) entry.description = state.description;
  if (state.changes.length) entry.changes = state.changes;

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
