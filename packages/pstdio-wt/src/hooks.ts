import { existsSync, statSync } from "node:fs";
import { join } from "node:path";
import type {
  HookName,
  HookPayload,
  HookResult,
  RunHookOptions,
  SessionHookName,
  TicketHookName,
  WorktreeHookName,
} from "./types";

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

const toUpperSnake = (key: string) => key.toUpperCase();

const formatEnvValue = (value: unknown): string | undefined => {
  if (value === null || value === undefined) return undefined;
  if (Array.isArray(value)) return JSON.stringify(value);
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
};

export const buildEnvFromPayload = (hookName: HookName, payload: HookPayload) => {
  const env: Record<string, string> = { PSTDIO_HOOK: hookName };

  for (const [key, value] of Object.entries(payload)) {
    const formatted = formatEnvValue(value);
    if (formatted !== undefined) {
      env[`PSTDIO_${toUpperSnake(key)}`] = formatted;
    }
  }

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

export const runHook = async (
  hookName: HookName,
  payload: HookPayload,
  options: RunHookOptions,
): Promise<HookResult> => {
  const scriptPath = resolveHookScript(options.repoPath, hookName);
  if (!scriptPath) return skippedResult(hookName);

  const env = buildEnvFromPayload(hookName, payload);
  const worktreePath = typeof payload.worktree_path === "string" ? payload.worktree_path : undefined;
  const cwd = options.cwd ?? (worktreePath && existsSync(worktreePath) ? worktreePath : options.repoPath);
  const timeoutMs = options.timeoutMs ?? HOOK_TIMEOUT_MS;

  const stdinPayload = JSON.stringify(payload);

  const mode = statSync(scriptPath).mode;
  if (!(mode & 0o111)) {
    return {
      hook: hookName,
      skipped: false,
      exitCode: 1,
      stdout: "",
      stderr: `Hook "${hookName}" is not executable: ${scriptPath}\nRun: chmod +x ${scriptPath}\n`,
    };
  }

  const proc = Bun.spawn([scriptPath], {
    cwd,
    stdin: new Blob([stdinPayload]),
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

const PAYLOAD_OVERRIDE_PREFIX = "PSTDIO_PAYLOAD=";

export const parsePayloadOverride = (stdout: string): Record<string, unknown> | null => {
  const lines = stdout.split("\n");
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i]!;
    if (line.startsWith(PAYLOAD_OVERRIDE_PREFIX)) {
      try {
        return JSON.parse(line.slice(PAYLOAD_OVERRIDE_PREFIX.length)) as Record<string, unknown>;
      } catch {
        return null;
      }
    }
  }
  return null;
};

export const listHooks = (repoPath: string) =>
  HOOK_NAMES.map((name) => ({
    name,
    exists: resolveHookScript(repoPath, name) !== null,
    blocking: isBlockingHook(name),
  }));
