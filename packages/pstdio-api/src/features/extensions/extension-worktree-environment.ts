import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { ExtensionWorktreesApi } from "@pstdio/sdk/extensions";
import { cleanupWorkspaceWorktree } from "../workspaces/worktree-cleanup";
import type { ExtensionsRouteDeps } from "./deps";

type WorktreeEnvironmentDeps = Pick<
  ExtensionsRouteDeps,
  "fileService" | "repoService" | "statusService" | "ticketService" | "workspaceService"
>;

const AGENT_DIRS = [".claude", ".opencode", ".agents"];

const notFound = () => ({ status: 404 });

const readTicketContent = async (deps: WorktreeEnvironmentDeps, ticket: { file_id?: string | null }) => {
  if ("content" in ticket && typeof ticket.content === "string") return ticket.content;
  if (!ticket.file_id) return "";

  const file = await deps.fileService.get(ticket.file_id);
  if (!file || !existsSync(file.storage_path)) return "";
  return readFileSync(file.storage_path, "utf8");
};

const listTickets = async (deps: WorktreeEnvironmentDeps, projectId: string, input: Record<string, unknown> = {}) => {
  const statusName = typeof input.status === "string" ? input.status : undefined;
  const status = statusName ? await deps.statusService.getByName(projectId, statusName) : null;
  const tickets = await deps.ticketService.list(projectId, {
    archived: typeof input.archived === "boolean" ? input.archived : undefined,
    draft: typeof input.draft === "boolean" ? input.draft : undefined,
    parent_id: typeof input.parent_id === "string" ? input.parent_id : undefined,
    search: typeof input.search === "string" ? input.search : undefined,
    shorthand: typeof input.shorthand === "string" ? input.shorthand : undefined,
    status_id: status?.id,
  });

  const statuses = tickets.some((ticket) => ticket.status_id) ? await deps.statusService.list(projectId) : [];
  const statusMap = new Map(statuses.map((candidate) => [candidate.id, candidate.name]));

  return Promise.all(
    tickets.map(async (ticket) => {
      const tags = await deps.ticketService.getTagOptionAssignments(ticket.id);
      return {
        ...ticket,
        status_name: ticket.status_id ? (statusMap.get(ticket.status_id) ?? null) : null,
        tag_ids: tags.map((tag) => tag.id),
        tag_names: tags.map((tag) => tag.name),
      };
    }),
  );
};

const resolveTicket = async (deps: WorktreeEnvironmentDeps, projectId: string, ticketId: string) => {
  const byId = await deps.ticketService.get(ticketId);
  if (byId) return byId;

  const [byShorthand] = await listTickets(deps, projectId, { shorthand: ticketId });
  if (!byShorthand) throw notFound();
  return deps.ticketService.get(byShorthand.id);
};

const pullTicket = async (deps: WorktreeEnvironmentDeps, projectId: string, worktreePath: string, ticketId: string) => {
  const ticket = await resolveTicket(deps, projectId, ticketId);
  if (!ticket) throw notFound();

  const ticketDir = join(worktreePath, ".pstdio", "tickets", ticket.shorthand);
  mkdirSync(ticketDir, { recursive: true });
  writeFileSync(join(ticketDir, "ticket.md"), await readTicketContent(deps, ticket));
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
    bootstrap: (worktreeInput) => bootstrapWorktree(deps, input.projectId, worktreeInput),
    removeAllForTicket: (ticketInput) => removeAllWorktreesForTicket(deps, input.projectId, ticketInput),
  };
};
