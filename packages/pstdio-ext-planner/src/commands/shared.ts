import type { CommandRunContext } from "@pstdio/sdk/extensions";
import { applyFrontmatterValues, buildTicketFrontmatter } from "../local-ticket-workflow/ticket-frontmatter";
import { createPlannerStorage } from "../storage/planner-storage";

export const stringParam = (ctx: CommandRunContext, key: string) => {
  const value = ctx.params[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
};

export const stringArrayParam = (ctx: CommandRunContext, key: string) => {
  const value = ctx.params[key];
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string" && item.length > 0);
  if (typeof value === "string" && value.length > 0) return value.split(",").filter(Boolean);
  return undefined;
};

export const booleanParam = (ctx: CommandRunContext, key: string) => ctx.params[key] === true;

export const optionalBooleanParam = (ctx: CommandRunContext, key: string) => {
  const value = ctx.params[key];
  return typeof value === "boolean" ? value : undefined;
};

export const numberParam = (ctx: CommandRunContext, key: string) => {
  const value = ctx.params[key];
  return typeof value === "number" ? value : undefined;
};

export const isCliRun = (ctx: CommandRunContext) => ctx.params.__cli === true;

export const stringParamAny = (ctx: CommandRunContext, keys: string[]) => {
  for (const key of keys) {
    const value = stringParam(ctx, key);
    if (value) return value;
  }
  return undefined;
};

export const booleanParamAny = (ctx: CommandRunContext, keys: string[]) => keys.some((key) => booleanParam(ctx, key));

export const ticketIdParam = (ctx: CommandRunContext) =>
  stringParam(ctx, "ticket_id") ?? stringParam(ctx, "ticketId") ?? stringParam(ctx, "id");

export const idFromName = (name: string) =>
  name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

export const resolveProjectRoot = async (ctx: CommandRunContext) => {
  const repoPath = stringParamAny(ctx, ["repo_path", "repoPath", "repo-path"]);
  if (repoPath) return repoPath;

  const repo = (await ctx.repos.getDefault()) as { path: string };
  return repo.path;
};

export const resolveTagIds = async (ctx: CommandRunContext, storage: ReturnType<typeof createPlannerStorage>) => {
  const tagIds = stringArrayParam(ctx, "tag_ids") ?? stringArrayParam(ctx, "tagIds");
  if (tagIds) return tagIds;

  const tagNames = stringArrayParam(ctx, "tags") ?? stringArrayParam(ctx, "tag");
  return tagNames?.length ? storage.provider.resolveTagIds(tagNames) : undefined;
};

export const resolveStatusId = async (ctx: CommandRunContext, storage: ReturnType<typeof createPlannerStorage>) => {
  const statusId = stringParam(ctx, "status_id") ?? stringParam(ctx, "statusId");
  if (statusId) return statusId;

  const statusName = stringParam(ctx, "status");
  return statusName ? storage.provider.resolveStatusId(statusName) : undefined;
};

export const normalizeTicketContent = (content: string) => (content.startsWith("#") ? content : `# ${content}\n`);

export const extractTitle = (content: string) => {
  const heading = content
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line.startsWith("# "));
  return heading ? heading.slice(2).trim() : null;
};

export const ticketNumber = (projectShorthand: string, shorthand: string) => {
  const escaped = projectShorthand.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = shorthand.match(new RegExp(`^${escaped}-(\\d+)$`));
  return match ? Number(match[1]) : 0;
};

export const nextTicketShorthand = async (ctx: CommandRunContext, storage: ReturnType<typeof createPlannerStorage>) => {
  const project = (await ctx.project.get()) as { shorthand?: string };
  const projectShorthand = project.shorthand ?? "P";
  const active = await storage.listDetails({ archived: false });
  const archived = await storage.listDetails({ archived: true });
  const nextNumber =
    Math.max(0, ...[...active, ...archived].map((ticket) => ticketNumber(projectShorthand, ticket.shorthand))) + 1;
  return `${projectShorthand}-${nextNumber}`;
};

export const buildLocalTicketContent = (input: {
  shorthand: string;
  createdAt: string;
  draft: boolean;
  content: string;
  parentId?: string | null;
  userPrompt?: string | null;
  tags?: string[];
}) =>
  applyFrontmatterValues(
    buildTicketFrontmatter({
      shorthand: input.shorthand,
      createdAt: input.createdAt,
      draft: input.draft,
      parentId: input.parentId ?? null,
      userPrompt: input.userPrompt ?? null,
      dependsOn: null,
      parallelizable: null,
      blockedReason: null,
      tagNames: input.tags ?? [],
    }),
    input.content,
  );

export type TableCellRow = Record<string, string>;

export const formatTable = (header: TableCellRow, rows: TableCellRow[]) => {
  const keys = Object.keys(header);
  const widths = Object.fromEntries(
    keys.map((key) => [key, Math.max(header[key]!.length, ...rows.map((row) => row[key]!.length))]),
  );
  const line = (row: TableCellRow) => keys.map((key) => row[key]!.padEnd(widths[key]!)).join("   ");
  return [line(header), ...rows.map(line)].join("\n");
};

export const ticketResourceMatches = (ticketId: string, shorthand: string, value: unknown) => {
  if (!value || typeof value !== "object") return false;
  const ref = value as { type?: unknown; id?: unknown; label?: unknown; extensionId?: unknown };
  return (
    ref.type === "pstdio.planner.ticket" &&
    (ref.extensionId === undefined || ref.extensionId === "pstdio.planner") &&
    (ref.id === ticketId || ref.id === shorthand || ref.label === shorthand)
  );
};

export const workspaceMatchesTicket = (workspace: unknown, ticketId: string, shorthand: string) => {
  if (!workspace || typeof workspace !== "object") return false;
  const anchors = (workspace as { anchors_json?: unknown }).anchors_json;
  return Array.isArray(anchors) && anchors.some((anchor) => ticketResourceMatches(ticketId, shorthand, anchor));
};

export type StoredPlannerStatus = {
  id: string;
  name: string;
  color: string;
  sortOrder: number;
  isDefault: boolean;
  canDragOut: boolean;
  canDragIn: boolean;
  canCreate: boolean;
  columnActions: string[];
};

export type StoredPlannerTag = {
  id: string;
  name: string;
  type: "single_select" | "multi_select";
};

export type StoredPlannerTagOption = {
  id: string;
  tagId: string;
  name: string;
  color: string;
  sortOrder: number;
  icon: string | null;
  description: string | null;
};

export const readPlannerStatuses = async (ctx: CommandRunContext) =>
  (await createPlannerStorage(ctx).listStatuses()) as StoredPlannerStatus[];

export const writePlannerStatus = async (ctx: CommandRunContext, status: StoredPlannerStatus) => {
  await ctx.storage.collection("statuses").put(status.id, status);
  return status;
};

export const setOnlyDefaultStatus = async (ctx: CommandRunContext, statusId: string) => {
  const statuses = await readPlannerStatuses(ctx);
  for (const status of statuses) {
    await writePlannerStatus(ctx, { ...status, isDefault: status.id === statusId });
  }
};

export const readPlannerTags = async (ctx: CommandRunContext) => createPlannerStorage(ctx).listTags();

export const readPlannerTagOptions = async (ctx: CommandRunContext) =>
  (await ctx.storage.collection("tag_options").list()).map((item) => item.value as StoredPlannerTagOption);
