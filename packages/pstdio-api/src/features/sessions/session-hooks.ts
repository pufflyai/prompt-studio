import { eq, ticket_workspaces, tickets } from "pstdio-db";
import type { HookContext, HookName, HookResult } from "pstdio-wt";
import { resolveHookScript, runHook } from "pstdio-wt";
import type { RouteDeps } from "../deps";

const HOOK_NAME: Extract<HookName, "on-session-complete"> = "on-session-complete";

const TERMINAL_STATUSES = new Set(["completed", "failed", "cancelled"]);

export const isTerminalStatus = (status: string) => TERMINAL_STATUSES.has(status);

type SessionHookDeps = Pick<RouteDeps, "db" | "workspacesService" | "reposService">;

type SessionHookInput = {
  sessionId: string;
  sessionStatus: string;
  projectId: string;
};

const logFailure = (result: HookResult) => {
  const output = [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
  const suffix = output.length > 0 ? `\n${output}` : "";
  process.stderr.write(`[session-hooks] ${HOOK_NAME} failed with exit code ${result.exitCode}${suffix}\n`);
};

const logError = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`[session-hooks] ${HOOK_NAME} execution error: ${message}\n`);
};

const resolveTicketForWorkspace = async (db: SessionHookDeps["db"], workspaceId: string) => {
  const [row] = await db
    .select({ ticket_id: tickets.id, ticket_shorthand: tickets.shorthand })
    .from(ticket_workspaces)
    .innerJoin(tickets, eq(ticket_workspaces.ticket_id, tickets.id))
    .where(eq(ticket_workspaces.workspace_id, workspaceId));

  return row ?? null;
};

export const queueSessionCompleteHook = async (deps: SessionHookDeps, input: SessionHookInput) => {
  if (!isTerminalStatus(input.sessionStatus)) return;

  try {
    const repos = await deps.reposService.listByProject(input.projectId);
    const repoPaths = repos.map((r) => r.path);
    if (repoPaths.length === 0) return;

    const repoPath = [...repoPaths].reverse().find((p) => resolveHookScript(p, HOOK_NAME)) ?? repoPaths[0] ?? null;
    if (!repoPath) return;

    const workspace = await deps.workspacesService.getBySessionId(input.sessionId);

    const context: Omit<HookContext, "repoPath"> = {
      sessionId: input.sessionId,
      sessionStatus: input.sessionStatus,
      projectId: input.projectId,
    };

    if (workspace) {
      context.branch = workspace.branch ?? undefined;
      context.worktreePath = workspace.worktree_path ?? undefined;
      context.workspace = workspace.workspace_shorthand;

      const ticket = await resolveTicketForWorkspace(deps.db, workspace.id);
      if (ticket) {
        context.ticketId = ticket.ticket_id;
        context.ticketShorthand = ticket.ticket_shorthand;
      }
    }

    void runHook(HOOK_NAME, { ...context, repoPath }, repoPath)
      .then((result) => {
        if (result.skipped || result.exitCode === 0) return;
        logFailure(result);
      })
      .catch((error) => {
        logError(error);
      });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`[session-hooks] failed to resolve project repo for hook: ${message}\n`);
  }
};
