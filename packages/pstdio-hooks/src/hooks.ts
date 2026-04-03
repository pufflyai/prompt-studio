import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { createLogger } from "pstdio-logging";
import type {
  HookName,
  HookPayload,
  HookResult,
  RunHookOptions,
  SessionHookName,
  TicketHookName,
  WorktreeHookName,
} from "./types";

const LOGGER_CONFIG_KEYS = [
  "PSTDIO_DB_PATH",
  "PSTDIO_LOG_LEVEL",
  "PSTDIO_LOG_PATH",
  "PSTDIO_LOG_TARGETS",
  "PSTDIO_STATE_DIR",
  "PSTDIO_STORAGE_PATH",
] as const;

let hooksLogger: {
  cacheKey: string;
  logger: ReturnType<typeof createLogger>;
} | null = null;

const getLoggerCacheKey = () => LOGGER_CONFIG_KEYS.map((key) => `${key}=${process.env[key] ?? ""}`).join("|");

const getHooksLogger = () => {
  const cacheKey = getLoggerCacheKey();
  if (hooksLogger && hooksLogger.cacheKey === cacheKey) {
    return hooksLogger.logger;
  }

  hooksLogger = {
    cacheKey,
    logger: createLogger({ component: "hooks", service: "pstdio-hooks" }),
  };
  return hooksLogger.logger;
};

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

const BLOCKING_HOOKS = new Set<WorktreeHookName | TicketHookName>([
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

export const isAttemptStatusHook = (hookName: string) =>
  hookName.startsWith("pre-attempt-status") || hookName.startsWith("post-attempt-status");

const isPreAttemptStatusHook = (hookName: string): hookName is `pre-attempt-status-${string}` =>
  hookName.startsWith("pre-attempt-status");

export const isBlockingHook = (hookName: HookName) =>
  BLOCKING_HOOKS.has(hookName as WorktreeHookName | TicketHookName) || isPreAttemptStatusHook(hookName);

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

const asString = (value: unknown) => (typeof value === "string" && value.length > 0 ? value : undefined);

const collectHookContext = (payload: HookPayload) => ({
  project_id: asString(payload.project_id),
  request_id: asString(payload.request_id),
  session_id: asString(payload.session_id),
  ticket_id: asString(payload.ticket_id),
  workspace: asString(payload.workspace),
  workspace_id: asString(payload.workspace_id),
});

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
  const hookContext = collectHookContext(payload);

  if (!scriptPath) {
    getHooksLogger().info(
      {
        event: "hook.run.skipped",
        hook_name: hookName,
        repo_path: options.repoPath,
        ...hookContext,
      },
      "Hook script not found; skipping execution",
    );
    return skippedResult(hookName);
  }

  const env = buildEnvFromPayload(hookName, payload);
  const worktreePath = typeof payload.worktree_path === "string" ? payload.worktree_path : undefined;
  const cwd = options.cwd ?? (worktreePath && existsSync(worktreePath) ? worktreePath : options.repoPath);
  const timeoutMs = options.timeoutMs ?? HOOK_TIMEOUT_MS;
  const start = performance.now();

  getHooksLogger().info(
    {
      cwd,
      event: "hook.run.start",
      hook_name: hookName,
      is_blocking: isBlockingHook(hookName),
      repo_path: options.repoPath,
      timeout_ms: timeoutMs,
      ...hookContext,
    },
    "Hook execution started",
  );

  const stdinPayload = JSON.stringify(payload);

  const mode = statSync(scriptPath).mode;
  if (!(mode & 0o111)) {
    getHooksLogger().warn(
      {
        event: "hook.run.completed",
        exit_code: 1,
        hook_name: hookName,
        reason: "not_executable",
        ...hookContext,
      },
      "Hook script is not executable",
    );

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

    getHooksLogger().warn(
      {
        duration_ms: Math.round(performance.now() - start),
        event: "hook.run.completed",
        exit_code: 1,
        hook_name: hookName,
        reason: "timeout",
        timeout_ms: timeoutMs,
        ...hookContext,
      },
      "Hook execution timed out",
    );

    return {
      hook: hookName,
      skipped: false,
      exitCode: 1,
      stdout: "",
      stderr: `Hook "${hookName}" timed out after ${timeoutMs}ms\n`,
    };
  }

  const [stdout, stderr, exitCode] = result;
  const durationMs = Math.round(performance.now() - start);
  const level = exitCode === 0 ? "info" : "warn";

  getHooksLogger()[level](
    {
      duration_ms: durationMs,
      event: "hook.run.completed",
      exit_code: exitCode,
      hook_name: hookName,
      stderr_present: stderr.length > 0,
      stdout_present: stdout.length > 0,
      ...hookContext,
    },
    exitCode === 0 ? "Hook execution completed" : "Hook execution finished with non-zero exit code",
  );

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

const discoverAttemptStatusHooks = (repoPath: string): HookName[] => {
  const hooksDir = join(repoPath, ".pstdio", "hooks");
  if (!existsSync(hooksDir)) return [];

  try {
    const entries = readdirSync(hooksDir);
    return entries
      .filter((name) => name.startsWith("pre-attempt-status") || name.startsWith("post-attempt-status"))
      .sort() as HookName[];
  } catch {
    return [];
  }
};

export const listHooks = (repoPath: string) => {
  const attemptStatusHooks = discoverAttemptStatusHooks(repoPath);
  const allHooks: HookName[] = [...HOOK_NAMES, ...attemptStatusHooks];

  return allHooks.map((name) => ({
    name,
    exists: resolveHookScript(repoPath, name) !== null,
    blocking: isBlockingHook(name),
  }));
};
