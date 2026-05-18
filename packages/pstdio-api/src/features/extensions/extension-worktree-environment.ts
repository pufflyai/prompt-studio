import { existsSync, readFileSync } from "node:fs";
import type { PstdioClient } from "@pstdio/sdk/client";
import type { ExtensionWorktreesApi } from "@pstdio/sdk/extensions";
import type { HookClient } from "@pstdio/sdk/hooks";
import { bootstrapWorktree, removeAllWorktreesForTicket } from "@pstdio/sdk/plugins";
import { cleanupWorkspaceWorktree } from "../workspaces/worktree-cleanup";
import type { ExtensionsRouteDeps } from "./deps";

type WorktreeEnvironmentDeps = Pick<
  ExtensionsRouteDeps,
  "fileService" | "repoService" | "statusService" | "ticketService" | "workspaceService"
>;

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

const createHelperClient = (deps: WorktreeEnvironmentDeps): HookClient => {
  const client = {
    tickets: {
      list: (projectId: string, input?: Record<string, unknown>) => listTickets(deps, projectId, input),
      get: async (ticketId: string) => {
        const ticket = await deps.ticketService.get(ticketId);
        if (!ticket) throw notFound();
        return { ...ticket, content: await readTicketContent(deps, ticket) };
      },
      listFiles: (ticketId: string) => deps.fileService.listForTicket(ticketId),
      getFileContent: async (_ticketId: string, fileId: string) => {
        const file = await deps.fileService.get(fileId);
        if (!file || !existsSync(file.storage_path)) throw notFound();
        return new Uint8Array(readFileSync(file.storage_path));
      },
    },
    session: {
      followup: async () => {
        throw new Error("Session follow-up is not available from worktree helpers.");
      },
    },
    workspaces: {
      list: (projectId: string) => deps.workspaceService.list(projectId),
      removeWorktree: async (workspaceId: string) => {
        const workspace = await deps.workspaceService.get(workspaceId);
        if (!workspace) throw notFound();
        return { removed: await cleanupWorkspaceWorktree(deps, workspace) };
      },
    },
  } as unknown as PstdioClient & Pick<HookClient, "session">;

  return client as HookClient;
};

export const createExtensionWorktreesApi = (
  deps: WorktreeEnvironmentDeps,
  input: { projectId: string },
): ExtensionWorktreesApi => {
  const helperCtx = {
    client: createHelperClient(deps),
    projectId: input.projectId,
  };

  return {
    bootstrap: (worktreeInput) => bootstrapWorktree(helperCtx, worktreeInput),
    removeAllForTicket: (ticketInput) => removeAllWorktreesForTicket(helperCtx, ticketInput),
  };
};
