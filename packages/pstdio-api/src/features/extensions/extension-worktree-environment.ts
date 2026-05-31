import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import type { ExtensionWorktreesApi } from "@pstdio/sdk/extensions";
import { cleanupWorkspaceWorktree } from "../workspaces/worktree-cleanup";
import type { ExtensionsRouteDeps } from "./deps";

type WorktreeEnvironmentDeps = Pick<
  ExtensionsRouteDeps,
  "fileService" | "repoService" | "statusService" | "ticketService" | "workspaceService"
>;

const AGENT_DIRS = [".claude", ".opencode", ".agents"];
const TICKET_FILES_DIR = "files";

const notFound = () => ({ status: 404 });

const escapeYamlScalar = (value: string) => value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n");

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

const buildTicketFrontmatter = (input: {
  blockedReason?: string | null;
  createdAt: string;
  dependsOn?: string | null;
  draft?: boolean | null;
  parentId?: string | null;
  parallelizable?: string | null;
  shorthand: string;
  statusName?: string | null;
  tagNames: string[];
  userPrompt?: string | null;
}) => {
  const quote = (value: string) => `"${escapeYamlScalar(value)}"`;
  const lines = ["---", `ticket_id: ${quote(input.shorthand)}`, `created: ${quote(input.createdAt)}`];

  if (input.userPrompt) lines.splice(2, 0, `user_prompt: ${quote(input.userPrompt)}`);
  if (input.draft !== null && input.draft !== undefined) lines.push(`draft: ${input.draft}`);
  if (input.statusName) lines.push(`status: ${quote(input.statusName)}`);
  if (input.parentId) lines.push(`parent_id: ${quote(input.parentId)}`);
  if (input.dependsOn) lines.push(`depends_on: ${quote(input.dependsOn)}`);
  if (input.parallelizable) lines.push(`parallelizable: ${quote(input.parallelizable)}`);
  if (input.blockedReason) lines.push(`blocked_reason: ${quote(input.blockedReason)}`);
  if (input.tagNames.length > 0) lines.push(`tags: [${input.tagNames.map(quote).join(", ")}]`);

  lines.push("---");
  return lines.join("\n");
};

const readTicketContent = async (deps: WorktreeEnvironmentDeps, ticket: { file_id?: string | null }) => {
  if ("content" in ticket && typeof ticket.content === "string") return ticket.content;
  if (!ticket.file_id) return "";

  const file = await deps.fileService.get(ticket.file_id);
  if (!file || !existsSync(file.storage_path)) return "";
  return readFileSync(file.storage_path, "utf8");
};

const resolveTicket = async (deps: WorktreeEnvironmentDeps, projectId: string, ticketId: string) => {
  const byId = await deps.ticketService.get(ticketId);
  if (byId) return byId;

  const byShorthand = await deps.ticketService.getByShorthand(projectId, ticketId);
  if (!byShorthand) throw notFound();
  return byShorthand;
};

const resolveStatusName = async (deps: WorktreeEnvironmentDeps, projectId: string, statusId?: string | null) => {
  if (!statusId) return null;
  const statuses = await deps.statusService.list(projectId);
  return statuses.find((status) => status.id === statusId)?.name ?? null;
};

const resolveParentFrontmatterValue = async (
  deps: WorktreeEnvironmentDeps,
  projectId: string,
  parentId?: string | null,
) => {
  if (!parentId) return null;
  if (/^[A-Za-z]+-\d+$/.test(parentId)) return parentId;

  const parentTicket =
    (await deps.ticketService.get(parentId)) ?? (await deps.ticketService.getByShorthand(projectId, parentId));
  return parentTicket?.shorthand ?? parentId;
};

const resolveTicketAttachmentPath = (ticketDir: string, fileName: string) => {
  const filesDir = join(ticketDir, TICKET_FILES_DIR);
  const targetPath = resolve(filesDir, fileName);
  const rel = relative(filesDir, targetPath);

  if (isAbsolute(rel) || rel.startsWith("..")) {
    throw new Error(`Ticket file path resolves outside ticket files directory: ${fileName}`);
  }

  return targetPath;
};

const writeTicketAttachment = (ticketDir: string, fileName: string, content: Uint8Array) => {
  const filePath = resolveTicketAttachmentPath(ticketDir, fileName);
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, content);
};

const buildPulledTicketContent = async (
  deps: WorktreeEnvironmentDeps,
  projectId: string,
  ticket: Awaited<ReturnType<typeof resolveTicket>>,
) => {
  const [content, statusName, parentId, tags] = await Promise.all([
    readTicketContent(deps, ticket),
    resolveStatusName(deps, projectId, ticket.status_id),
    resolveParentFrontmatterValue(deps, projectId, ticket.parent_id),
    deps.ticketService.getTagOptionAssignments(ticket.id),
  ]);

  return applyFrontmatter(
    buildTicketFrontmatter({
      blockedReason: ticket.blocked_reason,
      createdAt: ticket.created_at,
      dependsOn: ticket.depends_on,
      draft: ticket.draft,
      parentId,
      parallelizable: ticket.parallelizable,
      shorthand: ticket.shorthand,
      statusName,
      tagNames: tags.map((tag) => tag.name),
      userPrompt: ticket.user_prompt,
    }),
    content,
  );
};

const pullTicket = async (deps: WorktreeEnvironmentDeps, projectId: string, worktreePath: string, ticketId: string) => {
  const ticket = await resolveTicket(deps, projectId, ticketId);
  if (!ticket) throw notFound();

  const ticketDir = join(worktreePath, ".pstdio", "tickets", ticket.shorthand);
  mkdirSync(ticketDir, { recursive: true });
  writeFileSync(join(ticketDir, "ticket.md"), await buildPulledTicketContent(deps, projectId, ticket));

  const files = await deps.fileService.listForTicket(ticket.id);
  const attachments = files.filter((file) => file.id !== ticket.file_id);

  for (const file of attachments) {
    writeTicketAttachment(ticketDir, file.file_name, readFileSync(file.storage_path));
  }
};

const bootstrapWorktree = async (
  deps: WorktreeEnvironmentDeps,
  projectId: string,
  input: { repoPath: string; worktreePath: string; ticketId?: string },
) => {
  const repoConfig = join(input.repoPath, ".pstdio", "config.json");
  const worktreeConfigDir = join(input.worktreePath, ".pstdio");

  if (existsSync(repoConfig)) {
    mkdirSync(worktreeConfigDir, { recursive: true });
    cpSync(repoConfig, join(worktreeConfigDir, "config.json"));
  }

  for (const agentDir of AGENT_DIRS) {
    const fromDir = join(input.repoPath, agentDir);
    if (!existsSync(fromDir)) continue;
    cpSync(fromDir, join(input.worktreePath, agentDir), { recursive: true });
  }

  if (input.ticketId) await pullTicket(deps, projectId, input.worktreePath, input.ticketId);
};

const removeAllWorktreesForTicket = async (
  deps: WorktreeEnvironmentDeps,
  projectId: string,
  input: { ticketId?: string },
) => {
  if (!input.ticketId) return 0;

  const ticket = await resolveTicket(deps, projectId, input.ticketId);
  const ticketShorthand = ticket?.shorthand ?? input.ticketId;
  const workspaces = await deps.workspaceService.list(projectId);
  const ticketWorkspaces = workspaces.filter(
    (workspace) => workspace.ticket_shorthand === ticketShorthand && workspace.worktree_path,
  );

  let removed = 0;
  for (const workspace of ticketWorkspaces) {
    try {
      if (await cleanupWorkspaceWorktree(deps, workspace)) removed++;
    } catch {
      // Best-effort cleanup to match remove-all behavior.
    }
  }

  return removed;
};

export const createExtensionWorktreesApi = (
  deps: WorktreeEnvironmentDeps,
  input: { projectId: string },
): ExtensionWorktreesApi => {
  return {
    /** @deprecated Ticket worktree bootstrap is owned by the pstdio tickets extension. */
    bootstrap: (worktreeInput) => bootstrapWorktree(deps, input.projectId, worktreeInput),
    /** @deprecated Ticket worktree cleanup is owned by the pstdio tickets extension. */
    removeAllForTicket: (ticketInput) => removeAllWorktreesForTicket(deps, input.projectId, ticketInput),
  };
};
