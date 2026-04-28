import type { CommandDefinition, CommandRunContext } from "@pstdio/sdk/extensions";
import { readTicketFile } from "../local-ticket-workflow/local-ticket-artifacts";
import { createPlannerStorage } from "../storage/planner-storage";
import {
  booleanParam,
  formatTable,
  isCliRun,
  resolveProjectRoot,
  stringParamAny,
  ticketIdParam,
  workspaceMatchesTicket,
} from "./shared";

export const ticketWorkspaceCommands = {
  listTicketWorkspaces: {
    title: "List planner ticket workspaces",
    target: "project",
    cli: {
      path: "tickets workspaces",
      description: "List active workspaces linked to a planner-owned ticket.",
      options: {
        id: { type: "string", required: true, description: "Ticket shorthand." },
        json: { type: "boolean", description: "Output as JSON." },
      },
    },
    async run(ctx: CommandRunContext) {
      const ticketId = ticketIdParam(ctx);
      if (!ticketId) throw new Error("Ticket id is required.");
      const ticket = await createPlannerStorage(ctx).getDetails(ticketId);
      if (!ticket) throw new Error(`Ticket not found: ${ticketId}`);
      const workspaces = (await ctx.workspaces.list()).filter((workspace) =>
        workspaceMatchesTicket(workspace, ticket.id, ticket.shorthand),
      );

      if (!isCliRun(ctx)) return workspaces;
      if (workspaces.length === 0) return "No ticket workspaces found.";
      if (booleanParam(ctx, "json")) return JSON.stringify(workspaces, null, 2);

      return formatTable(
        { workspace: "Workspace", branch: "Branch", path: "Path" },
        workspaces.map((workspace) => {
          const ws = workspace as {
            workspace_shorthand?: string;
            branch?: string | null;
            worktree_path?: string | null;
          };
          return {
            workspace: ws.workspace_shorthand ?? "-",
            branch: ws.branch ?? "-",
            path: ws.worktree_path ?? "-",
          };
        }),
      );
    },
  },
  listTicketWorktrees: {
    title: "List planner ticket worktrees",
    target: "project",
    cli: {
      path: "tickets worktrees list",
      description: "List active worktrees linked to a planner-owned ticket.",
      options: {
        id: { type: "string", required: true, description: "Ticket shorthand." },
        json: { type: "boolean", description: "Output as JSON." },
      },
    },
    async run(ctx: CommandRunContext) {
      const ticketId = ticketIdParam(ctx);
      if (!ticketId) throw new Error("Ticket id is required.");
      const ticket = await createPlannerStorage(ctx).getDetails(ticketId);
      if (!ticket) throw new Error(`Ticket not found: ${ticketId}`);
      const workspaces = (await ctx.workspaces.list()).filter((workspace) => {
        const ws = workspace as { worktree_path?: string | null };
        return Boolean(ws.worktree_path) && workspaceMatchesTicket(workspace, ticket.id, ticket.shorthand);
      });

      if (!isCliRun(ctx)) return workspaces;
      if (workspaces.length === 0) return `No worktrees found for ticket ${ticket.shorthand}`;
      if (booleanParam(ctx, "json")) return JSON.stringify(workspaces, null, 2);

      return formatTable(
        { workspace: "Workspace", branch: "Branch", path: "Path" },
        workspaces.map((workspace) => {
          const ws = workspace as {
            workspace_shorthand?: string;
            branch?: string | null;
            worktree_path?: string | null;
          };
          return {
            workspace: ws.workspace_shorthand ?? "-",
            branch: ws.branch ?? "-",
            path: ws.worktree_path ?? "-",
          };
        }),
      );
    },
  },
  removeTicketWorktrees: {
    title: "Remove planner ticket worktrees",
    target: "project",
    cli: {
      path: "tickets worktrees remove-all",
      description: "Remove all worktrees linked to a planner-owned ticket.",
      options: {
        id: { type: "string", required: true, description: "Ticket shorthand." },
      },
    },
    async run(ctx: CommandRunContext) {
      const ticketId = ticketIdParam(ctx);
      if (!ticketId) throw new Error("Ticket id is required.");
      const ticket = await createPlannerStorage(ctx).getDetails(ticketId);
      if (!ticket) throw new Error(`Ticket not found: ${ticketId}`);
      const workspaces = (await ctx.workspaces.list()).filter((workspace) => {
        const ws = workspace as { worktree_path?: string | null };
        return Boolean(ws.worktree_path) && workspaceMatchesTicket(workspace, ticket.id, ticket.shorthand);
      });

      if (workspaces.length === 0) return `No worktrees found for ticket ${ticket.shorthand}`;

      let removed = 0;
      for (const workspace of workspaces) {
        const ws = workspace as { id?: string };
        if (!ws.id) continue;
        await ctx.workspaces.removeWorktree(ws.id);
        removed++;
      }

      return `Removed ${removed} worktree(s) for ticket ${ticket.shorthand}`;
    },
  },
  implementTicket: {
    title: "Implement planner ticket",
    target: "project",
    cli: {
      path: "tickets implement",
      description: "Move a planner-owned ticket to wip and launch the configured agent.",
      options: {
        id: { type: "string", required: true, description: "Ticket shorthand." },
      },
    },
    async run(ctx: CommandRunContext) {
      const ticketId = ticketIdParam(ctx);
      if (!ticketId) throw new Error("Ticket id is required.");
      const storage = createPlannerStorage(ctx);
      const ticket = await storage.getDetails(ticketId);
      if (!ticket) throw new Error(`Ticket not found: ${ticketId}`);

      const wipStatusId = await storage.provider.resolveStatusId("wip").catch(() => null);
      if (wipStatusId) await storage.provider.update(ticket.id, { statusId: wipStatusId });

      const projectRoot = await resolveProjectRoot(ctx);
      const prompt = readTicketFile(projectRoot, ticket.shorthand) ?? ticket.content;
      await ctx.sessions.create({
        title: ticket.displayTitle ?? ticket.shorthand,
        prompt,
      });

      return `Ticket ${ticket.shorthand} moved to wip\nLaunching agent...`;
    },
  },
  updateTicketWhenAttemptStatus: {
    title: "Update planner ticket when attempts match",
    target: "project",
    cli: {
      path: "tickets update-when-attempt-status",
      description: "Conditionally update a planner-owned ticket when all attempts match a status.",
      options: {
        id: { type: "string", required: true, description: "Ticket shorthand." },
        "all-attempts-status": { type: "string", required: true, description: "Required attempt status name." },
        "set-status": { type: "string", required: true, description: "Ticket status name to set." },
      },
    },
    async run(ctx: CommandRunContext) {
      const ticketId = ticketIdParam(ctx);
      if (!ticketId) throw new Error("Ticket id is required.");
      const storage = createPlannerStorage(ctx);
      const ticket = await storage.getDetails(ticketId);
      if (!ticket) throw new Error(`Ticket not found: ${ticketId}`);

      const requiredStatus = stringParamAny(ctx, ["all_attempts_status", "allAttemptsStatus", "all-attempts-status"]);
      const setStatus = stringParamAny(ctx, ["set_status", "setStatus", "set-status"]);
      if (!requiredStatus || !setStatus) throw new Error("Attempt status and target ticket status are required.");

      const workspaces = (await ctx.workspaces.list()).filter((workspace) =>
        workspaceMatchesTicket(workspace, ticket.id, ticket.shorthand),
      ) as Array<{ attempt_status_name?: string | null }>;
      const updated =
        workspaces.length > 0 && workspaces.every((workspace) => workspace.attempt_status_name === requiredStatus);

      if (updated) {
        await storage.provider.update(ticket.id, { statusId: await storage.provider.resolveStatusId(setStatus) });
      }

      if (!isCliRun(ctx)) return { updated };
      return updated
        ? `Ticket ${ticket.shorthand} updated to "${setStatus}".`
        : `No change - not all attempts have status "${requiredStatus}".`;
    },
  },
} satisfies Record<string, CommandDefinition>;
