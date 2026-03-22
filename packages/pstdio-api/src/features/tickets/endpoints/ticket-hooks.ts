import type { HookContext, HookName, HookResult } from "pstdio-wt";
import { resolveHookScript, runHook } from "pstdio-wt";
import type { RouteDeps } from "../../deps";

type TicketHookName = Extract<HookName, "on-ticket-status-change" | "on-ticket-archive" | "on-ticket-delete">;

type TicketHookSpec = {
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

const runTicketHook = (repoPaths: string[], hook: TicketHookSpec) => {
  const repoPath = resolveRepoPathForHook(repoPaths, hook.hookName);
  if (!repoPath) return;

  void runHook(hook.hookName, { ...hook.context, repoPath }, repoPath)
    .then((result) => {
      if (result.skipped || result.exitCode === 0) return;
      logTicketHookFailure(hook.hookName, result);
    })
    .catch((error) => {
      logTicketHookError(hook.hookName, error);
    });
};

export const queueTicketHooks = async (
  deps: Pick<RouteDeps, "reposService">,
  input: {
    projectId: string;
    hooks: TicketHookSpec[];
  },
) => {
  if (input.hooks.length === 0) return;

  try {
    const repos = await deps.reposService.listByProject(input.projectId);
    const repoPaths = repos.map((repo) => repo.path);
    if (repoPaths.length === 0) return;

    for (const hook of input.hooks) {
      runTicketHook(repoPaths, hook);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`[ticket-hooks] failed to resolve project repo for hooks: ${message}\n`);
  }
};
