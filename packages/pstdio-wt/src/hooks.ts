import { existsSync } from "node:fs";
import { join } from "node:path";
import type { HookContext, HookName, HookResult, SessionHookName, TicketHookName, WorktreeHookName } from "./types";

const WORKTREE_HOOK_NAMES: WorktreeHookName[] = [
  "pre-worktree-create",
  "post-worktree-create",
  "pre-commit",
  "post-commit",
  "pre-rebase",
  "post-rebase",
  "pre-merge",
  "post-merge",
  "pre-worktree-remove",
  "post-worktree-remove",
  "on-conflict",
];

const SESSION_HOOK_NAMES: SessionHookName[] = [
  "post-session-start",
  "post-session-success",
  "post-session-fail",
  "post-session-resume",
  "post-session-await-input",
];

const TICKET_HOOK_NAMES: TicketHookName[] = [
  "pre-ticket-creation",
  "post-ticket-creation",
  "pre-ticket-status-change",
  "post-ticket-status-change",
  "pre-ticket-archive",
  "post-ticket-archive",
  "pre-ticket-deletion",
  "post-ticket-deletion",
];

const HOOK_NAMES: HookName[] = [...WORKTREE_HOOK_NAMES, ...SESSION_HOOK_NAMES, ...TICKET_HOOK_NAMES];

const BLOCKING_HOOKS = new Set<HookName>([
  "pre-worktree-create",
  "post-worktree-create",
  "pre-commit",
  "pre-rebase",
  "pre-merge",
  "pre-worktree-remove",
  "pre-ticket-creation",
  "pre-ticket-status-change",
  "pre-ticket-archive",
  "pre-ticket-deletion",
]);

export const isBlockingHook = (hookName: HookName) => BLOCKING_HOOKS.has(hookName);

export const resolveHookScript = (repoPath: string, hookName: HookName) => {
  const scriptPath = join(repoPath, ".pstdio", "hooks", hookName);
  return existsSync(scriptPath) ? scriptPath : null;
};

export const buildHookEnv = (hookName: HookName, context: HookContext) => {
  const env: Record<string, string> = {
    PSTDIO_HOOK: hookName,
    PSTDIO_REPO_PATH: context.repoPath,
  };

  if (context.branch) env.PSTDIO_BRANCH = context.branch;
  if (context.worktreePath) env.PSTDIO_WORKTREE_PATH = context.worktreePath;
  if (context.workspace) env.PSTDIO_WORKSPACE = context.workspace;
  if (context.ticketShorthand) env.PSTDIO_TICKET = context.ticketShorthand;
  if (context.target) env.PSTDIO_TARGET = context.target;
  if (context.commitSha) env.PSTDIO_COMMIT_SHA = context.commitSha;
  if (context.commitMessage) env.PSTDIO_COMMIT_MESSAGE = context.commitMessage;
  if (context.projectId) env.PSTDIO_PROJECT_ID = context.projectId;

  return env;
};

const skippedResult = (hookName: HookName): HookResult => ({
  hook: hookName,
  skipped: true,
  exitCode: 0,
  stdout: "",
  stderr: "",
});

const HOOK_TIMEOUT_MS = 60_000;

type RunHookOptions = {
  timeoutMs?: number;
};

export const runHook = async (
  hookName: HookName,
  context: HookContext,
  repoPath: string,
  options?: RunHookOptions,
): Promise<HookResult> => {
  const scriptPath = resolveHookScript(repoPath, hookName);
  if (!scriptPath) return skippedResult(hookName);

  const env = buildHookEnv(hookName, context);
  const cwd = context.worktreePath ?? context.repoPath;
  const timeoutMs = options?.timeoutMs ?? HOOK_TIMEOUT_MS;

  const stdinPayload = context.payload ? JSON.stringify(context.payload) : undefined;

  const proc = Bun.spawn([scriptPath], {
    cwd,
    stdin: stdinPayload ? new Blob([stdinPayload]) : undefined,
    stdout: "pipe",
    stderr: "pipe",
    env: { ...process.env, ...env },
  });

  // allow the process to exit if the hook is fire-and-forget
  if (!isBlockingHook(hookName)) proc.unref();

  const completed = Promise.all([new Response(proc.stdout).text(), new Response(proc.stderr).text(), proc.exited]);

  const timeoutPromise = new Promise<null>((resolve) => {
    const timer = setTimeout(() => resolve(null), timeoutMs);
    // allow the process to exit if the hook is fire-and-forget
    if (typeof timer === "object" && "unref" in timer) timer.unref();
  });
  const result = await Promise.race([completed, timeoutPromise]);

  if (!result) {
    proc.kill(9);
    await proc.exited;
    return {
      hook: hookName,
      skipped: false,
      exitCode: 1,
      stdout: "",
      stderr: `Hook "${hookName}" timed out after ${timeoutMs}ms\n`,
    };
  }

  const [stdout, stderr, exitCode] = result;
  return { hook: hookName, skipped: false, exitCode, stdout, stderr };
};

export const listHooks = (repoPath: string) =>
  HOOK_NAMES.map((name) => ({
    name,
    exists: resolveHookScript(repoPath, name) !== null,
    blocking: isBlockingHook(name),
  }));
