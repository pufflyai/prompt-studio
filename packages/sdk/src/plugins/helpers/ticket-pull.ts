import { existsSync, mkdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import type { TicketDetail, TicketFile, TicketListItem } from "../../resources";
import type { PluginHelperContext } from "./context";

type TicketPullRef = {
  ticketId?: string;
};

type PullTicketsInput = TicketPullRef & {
  rootPath: string;
  force?: boolean;
  log?: (message: string) => void;
};

type PullTicketsResult = {
  pulledTicketShorthands: string[];
  downloadedFileCount: number;
};

type FrontmatterFields = {
  shorthand: string;
  created_at: string;
  draft: boolean | null;
  status_name: string | null;
  parent_id: string | null;
  user_prompt: string | null;
  depends_on: string | null;
  parallelizable: string | null;
  blocked_reason: string | null;
  tag_names: string[];
};

const TICKETS_DIR = join(".pstdio", "tickets");
const TICKET_FILES_DIR = "files";

const escapeYamlScalar = (value: string) => value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n");

const buildTicketFrontmatter = (fields: FrontmatterFields) => {
  const lines: string[] = ["---"];
  const q = (value: string) => `"${escapeYamlScalar(value)}"`;

  lines.push(`ticket_id: ${q(fields.shorthand)}`);
  if (fields.user_prompt) lines.push(`user_prompt: ${q(fields.user_prompt)}`);
  lines.push(`created: ${q(fields.created_at)}`);
  if (fields.draft !== null) lines.push(`draft: ${fields.draft}`);

  if (fields.status_name) lines.push(`status: ${q(fields.status_name)}`);
  if (fields.parent_id) lines.push(`parent_id: ${q(fields.parent_id)}`);
  if (fields.depends_on) lines.push(`depends_on: ${q(fields.depends_on)}`);
  if (fields.parallelizable) lines.push(`parallelizable: ${q(fields.parallelizable)}`);
  if (fields.blocked_reason) lines.push(`blocked_reason: ${q(fields.blocked_reason)}`);
  if (fields.tag_names.length > 0) lines.push(`tags: [${fields.tag_names.map(q).join(", ")}]`);

  lines.push("---");
  return lines.join("\n");
};

const stripFrontmatter = (content: string) => {
  if (!content.startsWith("---")) return content;
  const closingIndex = content.indexOf("---", 3);
  if (closingIndex === -1) return content;
  return content.slice(closingIndex + 3);
};

const applyFrontmatter = (frontmatter: string, content: string) => {
  const body = stripFrontmatter(content).replace(/^\n+/, "");
  if (!body) return frontmatter;
  return `${frontmatter}\n\n${body}`;
};

const toRelativeFilePath = (baseDir: string, absolutePath: string) =>
  relative(baseDir, absolutePath).split("\\").join("/");

const resolveTicketDir = (rootPath: string, shorthand: string) => {
  const exactDir = join(rootPath, TICKETS_DIR, shorthand);
  if (!existsSync(exactDir)) return null;

  if (!statSync(exactDir).isDirectory()) {
    throw new Error(`Invalid ticket path for ${shorthand}: .pstdio/tickets/${shorthand} is not a directory.`);
  }

  return exactDir;
};

const writeTicketFile = (rootPath: string, shorthand: string, content: string, overwrite = true) => {
  const existingDir = resolveTicketDir(rootPath, shorthand);
  const dir = existingDir ?? join(rootPath, TICKETS_DIR, shorthand);
  const filePath = join(dir, "ticket.md");

  if (!overwrite && existsSync(filePath)) {
    throw new Error(`Local file already exists: ${toRelativeFilePath(rootPath, filePath)}. Use force to overwrite.`);
  }

  mkdirSync(dir, { recursive: true });
  writeFileSync(filePath, content);
  return filePath;
};

const resolveTicketAttachmentPath = (rootPath: string, shorthand: string, fileName: string) => {
  const ticketDir = resolveTicketDir(rootPath, shorthand);
  if (!ticketDir) throw new Error(`Ticket directory not found for ${shorthand}`);

  const filesDir = join(ticketDir, TICKET_FILES_DIR);
  const targetPath = resolve(filesDir, fileName);
  const rel = relative(filesDir, targetPath);

  if (isAbsolute(rel) || rel.startsWith("..")) {
    throw new Error(`Ticket file path resolves outside ticket files directory: ${fileName}`);
  }

  return targetPath;
};

const writeTicketAttachment = (
  rootPath: string,
  shorthand: string,
  fileName: string,
  content: Uint8Array,
  overwrite = false,
) => {
  const filePath = resolveTicketAttachmentPath(rootPath, shorthand, fileName);

  if (!overwrite && existsSync(filePath)) {
    throw new Error(`Local file already exists: ${toRelativeFilePath(rootPath, filePath)}. Use force to overwrite.`);
  }

  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, content);
  return filePath;
};

const isNotFoundError = (error: unknown) =>
  typeof error === "object" && error !== null && "status" in error && (error as { status?: unknown }).status === 404;

const isTicketShorthand = (value: string) => /^[A-Za-z]+-\d+$/.test(value);

const resolveParentFrontmatterValue = async (ctx: PluginHelperContext, parentId: string | null) => {
  if (!parentId) return null;
  if (isTicketShorthand(parentId)) return parentId;

  try {
    const parentTicket = await ctx.client.tickets.get(parentId);
    return parentTicket.shorthand || parentId;
  } catch (error) {
    if (isNotFoundError(error)) return parentId;
    throw error;
  }
};

const resolveTicketByShorthand = async (ctx: PluginHelperContext, ticketShorthand: string) => {
  const published = await ctx.client.tickets.list(ctx.projectId, { shorthand: ticketShorthand });
  if (published.length > 0) return published[0] as TicketListItem;

  const drafts = await ctx.client.tickets.list(ctx.projectId, { shorthand: ticketShorthand, draft: true });
  return drafts[0] as TicketListItem | undefined;
};

const resolveTicketById = async (ctx: PluginHelperContext, ticketId: string) => {
  try {
    const detail = await ctx.client.tickets.get(ticketId);
    const byShorthand = await resolveTicketByShorthand(ctx, detail.shorthand);

    if (byShorthand) return byShorthand;

    return {
      ...detail,
      status_name: null,
      tag_ids: [],
      tag_names: [],
    } as TicketListItem;
  } catch (error) {
    if (isNotFoundError(error)) return null;
    throw error;
  }
};

const resolveTicketByRef = async (ctx: PluginHelperContext, ticketId: string) => {
  const byId = await resolveTicketById(ctx, ticketId);
  if (byId) return byId;
  return resolveTicketByShorthand(ctx, ticketId);
};

const pullSingleTicket = async (
  ctx: PluginHelperContext,
  rootPath: string,
  ticketListItem: TicketListItem,
  force: boolean,
  log: (message: string) => void,
) => {
  const ticket = (await ctx.client.tickets.get(ticketListItem.id)) as TicketDetail;
  const parentId = await resolveParentFrontmatterValue(ctx, ticket.parent_id);

  const frontmatter = buildTicketFrontmatter({
    shorthand: ticketListItem.shorthand,
    created_at: ticket.created_at,
    draft: ticket.draft,
    status_name: ticketListItem.status_name,
    parent_id: parentId,
    user_prompt: ticket.user_prompt ?? null,
    depends_on: ticket.depends_on,
    parallelizable: ticket.parallelizable,
    blocked_reason: ticket.blocked_reason,
    tag_names: ticketListItem.tag_names ?? [],
  });

  const content = applyFrontmatter(frontmatter, ticket.content ?? "");
  const filePath = writeTicketFile(rootPath, ticketListItem.shorthand, content, force);
  const ticketDir = filePath.replace(/\/ticket\.md$/, "").replace(`${rootPath}/`, "");

  const files = await ctx.client.tickets.listFiles(ticket.id);
  const attachments = files.filter((file: TicketFile) => file.id !== ticket.file_id);

  for (const file of attachments) {
    const fileContent = await ctx.client.tickets.getFileContent(ticket.id, file.id);
    writeTicketAttachment(rootPath, ticketListItem.shorthand, file.file_name, fileContent, force);
  }

  log(`Pulled ticket ${ticketListItem.shorthand} to ${ticketDir}`);
  if (attachments.length > 0) log(`Downloaded ${attachments.length} ticket files`);

  return { shorthand: ticketListItem.shorthand, downloadedFileCount: attachments.length };
};

export const pullTickets = async (ctx: PluginHelperContext, input: PullTicketsInput) => {
  const force = input.force ?? false;
  const log = input.log ?? (() => {});

  if (input.ticketId) {
    const ticket = await resolveTicketByRef(ctx, input.ticketId);
    if (!ticket) throw new Error(`Ticket not found: ${input.ticketId}`);

    const result = await pullSingleTicket(ctx, input.rootPath, ticket, force, log);
    return { pulledTicketShorthands: [result.shorthand], downloadedFileCount: result.downloadedFileCount };
  }

  const listedTickets = await ctx.client.tickets.list(ctx.projectId, { archived: false });
  const tickets = listedTickets.filter((ticket) => !ticket.archived);

  if (tickets.length === 0) {
    log("No tickets to pull.");
    return { pulledTicketShorthands: [], downloadedFileCount: 0 };
  }

  const pulledTicketShorthands: string[] = [];
  let downloadedFileCount = 0;

  for (const ticket of tickets) {
    const result = await pullSingleTicket(ctx, input.rootPath, ticket, force, log);
    pulledTicketShorthands.push(result.shorthand);
    downloadedFileCount += result.downloadedFileCount;
  }

  log(`Pulled ${tickets.length} tickets`);
  return { pulledTicketShorthands, downloadedFileCount };
};

export type { PullTicketsInput, PullTicketsResult };
