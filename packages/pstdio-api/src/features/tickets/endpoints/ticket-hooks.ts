import { eq, ticket_workspaces, workspaces } from "pstdio-db";
import type { HookContext, HookName, HookResult } from "pstdio-wt";
import { resolveHookScript, runHook } from "pstdio-wt";
import type { RouteDeps } from "../../deps";

type PreTicketHookName = Extract<HookName, "pre-ticket-status-change" | "pre-ticket-archive" | "pre-ticket-delete">;

type PostTicketHookName = Extract<HookName, "post-ticket-status-change" | "post-ticket-archive" | "post-ticket-delete">;

type TicketHookName = PreTicketHookName | PostTicketHookName;

type TicketHookDeps = Pick<RouteDeps, "db" | "reposService">;

export type TicketHookSpec = {
  hookName: TicketHookName;
  context: Omit<HookContext, "repoPath">;
};

const logTicketHookFailure = (hookName: TicketHookName, result: HookResult) => {
  const output = [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
  const suffix = output.length > 0 ? `\n${output}` : "";
  process.stderr.write(`[ticket-hooks] ${hookName} failed with exit code ${result.exitCode}${suffix}\n`);
};

const logTicketHookError = (hookName: TicketHookName, error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`[ticket-hooks] ${hookName} execution error: ${message}\n`);
};

const resolveRepoPathForHook = (repoPaths: string[], hookName: TicketHookName) => {
  const pathWithHook = [...repoPaths].reverse().find((repoPath) => resolveHookScript(repoPath, hookName));
  return pathWithHook ?? repoPaths[0] ?? null;
};

const resolveRepoPaths = async (deps: TicketHookDeps, projectId: string) => {
  const repos = await deps.reposService.listByProject(projectId);
  return repos.map((repo) => repo.path);
};

const resolveWorkspaceForTicket = async (db: TicketHookDeps["db"], ticketId: string) => {
  const [row] = await db
    .select({
      branch: workspaces.branch,
      worktree_path: workspaces.worktree_path,
      workspace_shorthand: workspaces.workspace_shorthand,
    })
    .from(ticket_workspaces)
    .innerJoin(workspaces, eq(ticket_workspaces.workspace_id, workspaces.id))
    .where(eq(ticket_workspaces.ticket_id, ticketId));

  return row ?? null;
};

const enrichWithWorkspace = async (deps: TicketHookDeps, context: Omit<HookContext, "repoPath">) => {
  if (context.worktreePath || !context.ticketId) return context;

  const workspace = await resolveWorkspaceForTicket(deps.db, context.ticketId);
  if (!workspace) return context;

  return {
    ...context,
    branch: workspace.branch ?? undefined,
    worktreePath: workspace.worktree_path ?? undefined,
    workspace: workspace.workspace_shorthand,
  };
};

/** Runs a blocking pre-hook. Returns null if the operation should proceed, or the HookResult on rejection. */
export const runPreTicketHook = async (
  deps: TicketHookDeps,
  projectId: string,
  hook: TicketHookSpec,
): Promise<HookResult | null> => {
  try {
    const repoPaths = await resolveRepoPaths(deps, projectId);
    if (repoPaths.length === 0) return null;

    const repoPath = resolveRepoPathForHook(repoPaths, hook.hookName);
    if (!repoPath) return null;

    const context = await enrichWithWorkspace(deps, hook.context);
    const result = await runHook(hook.hookName, { ...context, repoPath }, repoPath);
    if (result.skipped || result.exitCode === 0) return null;

    logTicketHookFailure(hook.hookName, result);
    return result;
  } catch (error) {
    logTicketHookError(hook.hookName, error);
    return { hook: hook.hookName, skipped: false, exitCode: 1, stdout: "", stderr: String(error) };
  }
};

export const buildHookErrorMessage = (hookName: string, result: HookResult) => {
  const output = [result.stderr, result.stdout].filter(Boolean).join("\n").trim();
  if (output.length > 0) return output.slice(0, 1024);
  return `Hook "${hookName}" rejected the operation`;
};

/** Queues fire-and-forget post-hooks. */
export const queuePostTicketHooks = async (
  deps: TicketHookDeps,
  input: {
    projectId: string;
    hooks: TicketHookSpec[];
  },
) => {
  if (input.hooks.length === 0) return;

  try {
    const repoPaths = await resolveRepoPaths(deps, input.projectId);
    if (repoPaths.length === 0) return;

    for (const hook of input.hooks) {
      const repoPath = resolveRepoPathForHook(repoPaths, hook.hookName);
      if (!repoPath) continue;

      const context = await enrichWithWorkspace(deps, hook.context);

      void runHook(hook.hookName, { ...context, repoPath }, repoPath)
        .then((result) => {
          if (result.skipped || result.exitCode === 0) return;
          logTicketHookFailure(hook.hookName, result);
        })
        .catch((error) => {
          logTicketHookError(hook.hookName, error);
        });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`[ticket-hooks] failed to resolve project repo for hooks: ${message}\n`);
  }
};
