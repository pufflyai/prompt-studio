import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, isAbsolute, join, relative, resolve } from "node:path";
import type { PluginHelperContext } from "./context";
import { findTicketByRef } from "./find-ticket-by-ref";

type SaveTicketInput = {
  rootPath: string;
  ticketId?: string;
  status?: string;
  tags?: string[];
  log?: (message: string) => void;
};

type SaveTicketResult = {
  ticketShorthand: string;
  uploadedFileCount: number;
};

const TICKETS_DIR = join(".pstdio", "tickets");
const TICKET_FILES_DIR = "files";
const TICKET_ARTIFACTS_DIR = "artifacts";
const MAX_DISPLAY_TITLE_LENGTH = 50;
const ACTIONABLE_FRONTMATTER_KEYS = ["blocked_reason", "parent_id", "status"] as const;

type ParsedFrontmatter = { blocked_reason?: string; parent_id?: string; status?: string };

const resolveTicketDir = (rootPath: string, shorthand: string) => {
  const exactDir = join(rootPath, TICKETS_DIR, shorthand);
  if (!existsSync(exactDir)) return null;

  if (!statSync(exactDir).isDirectory()) {
    throw new Error(`Invalid ticket path for ${shorthand}: .pstdio/tickets/${shorthand} is not a directory.`);
  }

  return exactDir;
};

const readTicketFile = (rootPath: string, shorthand: string) => {
  const dir = resolveTicketDir(rootPath, shorthand);
  if (!dir) return null;

  const filePath = join(dir, "ticket.md");
  if (!existsSync(filePath)) return null;
  return readFileSync(filePath, "utf8");
};

const writeTicketFile = (rootPath: string, shorthand: string, content: string) => {
  const dir = resolveTicketDir(rootPath, shorthand) ?? join(rootPath, TICKETS_DIR, shorthand);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "ticket.md"), content);
};

const walkFiles = (baseDir: string, currentDir: string, files: string[]) => {
  const entries = readdirSync(currentDir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(currentDir, entry.name);

    if (entry.isDirectory()) {
      walkFiles(baseDir, fullPath, files);
      continue;
    }

    if (!entry.isFile()) continue;
    files.push(relative(baseDir, fullPath).split("\\").join("/"));
  }
};

const listDirFiles = (rootPath: string, shorthand: string, subDir: string) => {
  const dir = resolveTicketDir(rootPath, shorthand);
  if (!dir) return [];

  const baseDir = join(dir, subDir);
  if (!existsSync(baseDir)) return [];

  const files: string[] = [];
  walkFiles(baseDir, baseDir, files);
  files.sort();
  return files;
};

const readSafe = (rootPath: string, shorthand: string, subDir: string, requestedPath: string) => {
  const ticketDir = resolveTicketDir(rootPath, shorthand);
  if (!ticketDir) throw new Error(`Ticket directory not found: ${shorthand}`);

  const baseDir = join(ticketDir, subDir);
  const target = resolve(baseDir, requestedPath);
  const rel = relative(baseDir, target);

  if (isAbsolute(rel) || rel.startsWith("..")) {
    throw new Error(`Path resolves outside ticket ${subDir} directory: ${requestedPath}`);
  }

  return readFileSync(target);
};

const findFrontmatterClosingIndex = (content: string) => {
  if (!content.startsWith("---")) return -1;
  return content.indexOf("---", 3);
};

const stripFrontmatter = (content: string) => {
  const closing = findFrontmatterClosingIndex(content);
  if (closing === -1) return content;
  return content.slice(closing + 3);
};

const parseFrontmatter = (content: string) => {
  const closing = findFrontmatterClosingIndex(content);
  if (closing === -1) return {};

  const block = content.slice(3, closing).trim();
  const result: ParsedFrontmatter = {};

  for (const line of block.split("\n")) {
    const colonIndex = line.indexOf(":");
    if (colonIndex === -1) continue;

    const key = line.slice(0, colonIndex).trim();
    const raw = line
      .slice(colonIndex + 1)
      .trim()
      .replace(/^["']|["']$/g, "");

    if (!raw) continue;
    if (ACTIONABLE_FRONTMATTER_KEYS.includes(key as (typeof ACTIONABLE_FRONTMATTER_KEYS)[number])) {
      result[key as keyof ParsedFrontmatter] = raw;
    }
  }

  return result;
};

const frontmatterLines = (content: string) => {
  const closing = findFrontmatterClosingIndex(content);
  if (closing === -1) return [];
  const block = content.slice(3, closing).trim();
  if (!block) return [];
  return block.split("\n");
};

const frontmatterKey = (line: string) => {
  const colon = line.indexOf(":");
  if (colon === -1) return null;
  return line.slice(0, colon).trim();
};

const applyFrontmatter = (frontmatter: string, content: string) => {
  const body = stripFrontmatter(content).replace(/^\n+/, "");
  if (!body) return frontmatter;
  return `${frontmatter}\n\n${body}`;
};

const applyFrontmatterValues = (frontmatter: string, content: string) => {
  if (findFrontmatterClosingIndex(content) === -1) return applyFrontmatter(frontmatter, content);

  const overrides = new Map<string, string>();
  const overrideOrder: string[] = [];
  for (const line of frontmatterLines(frontmatter)) {
    const key = frontmatterKey(line);
    if (!key) continue;
    overrides.set(key, line);
    overrideOrder.push(key);
  }

  const existing = frontmatterLines(content);
  const merged = existing.map((line) => {
    const key = frontmatterKey(line);
    if (!key || !overrides.has(key)) return line;
    return overrides.get(key)!;
  });

  for (const key of overrideOrder) {
    if (existing.some((line) => frontmatterKey(line) === key)) continue;
    const line = overrides.get(key);
    if (line) merged.push(line);
  }

  return applyFrontmatter(["---", ...merged, "---"].join("\n"), content);
};

const markLocalTicketAsSaved = (content: string) =>
  applyFrontmatterValues(["---", "draft: false", "---"].join("\n"), content);

const stripMarkdownFormatting = (text: string) =>
  text
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\*\*([^*]*)\*\*/g, "$1")
    .replace(/\*([^*]*)\*/g, "$1")
    .replace(/`([^`]*)`/g, "$1");

const slugify = (text: string, maxLength: number) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maxLength)
    .replace(/-+$/, "");

const firstHeadingOrLine = (content: string) => {
  const lines = content.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("# ")) return trimmed.slice(2).trim();
  }
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length > 0) return trimmed;
  }
  return null;
};

const extractDisplayTitle = (content: string) => {
  const raw = firstHeadingOrLine(stripFrontmatter(content)) ?? "untitled";
  return slugify(stripMarkdownFormatting(raw), MAX_DISPLAY_TITLE_LENGTH);
};

const resolveStatusId = async (ctx: PluginHelperContext, statusName: string) => {
  const statuses = await ctx.client.statuses.list(ctx.projectId);
  const found = statuses.find((status) => status.name === statusName);
  if (!found) throw new Error(`Status not found: ${statusName}`);
  return found.id;
};

const resolveTagIds = async (ctx: PluginHelperContext, tagNames: string[]) => {
  const tags = await ctx.client.tags.list(ctx.projectId);
  const options = tags.flatMap((tag) => tag.options);
  return tagNames.map((name) => {
    const found = options.find((option) => option.name === name);
    if (!found) throw new Error(`Tag option not found: ${name}`);
    return found.id;
  });
};

export const saveTicket = async (ctx: PluginHelperContext, input: SaveTicketInput): Promise<SaveTicketResult> => {
  const log = input.log ?? (() => {});

  const ticket = await findTicketByRef(ctx, { ticketId: input.ticketId });
  if (!ticket) throw new Error(`Ticket not found: ${input.ticketId ?? "<none>"}`);

  const shorthand = ticket.shorthand;
  const content = readTicketFile(input.rootPath, shorthand);
  if (content === null) throw new Error(`Local ticket not found: .pstdio/tickets/${shorthand}/ticket.md`);

  const frontmatter = parseFrontmatter(content);
  const statusName = input.status ?? frontmatter.status;
  const statusId = statusName ? await resolveStatusId(ctx, statusName) : undefined;
  const tagIds = input.tags?.length ? await resolveTagIds(ctx, input.tags) : undefined;

  const body = stripFrontmatter(content).replace(/^\n+/, "");
  const uploaded = await ctx.client.tickets.uploadFile(ticket.id, {
    file_name: "ticket.md",
    content_base64: Buffer.from(body).toString("base64"),
    mime_type: "text/markdown",
  });

  await ctx.client.tickets.update(ticket.id, {
    blocked_reason: frontmatter.blocked_reason,
    file_id: uploaded.id,
    display_title: extractDisplayTitle(body),
    draft: false,
    parent_id: frontmatter.parent_id,
    tag_ids: tagIds,
    status_id: statusId,
  });

  let uploadedFileCount = 0;

  for (const fileName of listDirFiles(input.rootPath, shorthand, TICKET_FILES_DIR)) {
    const data = readSafe(input.rootPath, shorthand, TICKET_FILES_DIR, fileName);
    await ctx.client.tickets.uploadFile(ticket.id, {
      file_name: fileName,
      content_base64: data.toString("base64"),
    });
    uploadedFileCount++;
  }

  for (const relativePath of listDirFiles(input.rootPath, shorthand, TICKET_ARTIFACTS_DIR)) {
    const data = readSafe(input.rootPath, shorthand, TICKET_ARTIFACTS_DIR, relativePath);
    await ctx.client.tickets.uploadFile(ticket.id, {
      file_name: basename(relativePath),
      relative_path: relativePath,
      content_base64: data.toString("base64"),
    });
    uploadedFileCount++;
  }

  writeTicketFile(input.rootPath, shorthand, markLocalTicketAsSaved(content));

  log(`Saved ticket ${shorthand}`);
  if (uploadedFileCount > 0) log(`Uploaded ${uploadedFileCount} ticket files`);

  return { ticketShorthand: shorthand, uploadedFileCount };
};

export type { SaveTicketInput, SaveTicketResult };
