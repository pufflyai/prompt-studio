import { randomUUID } from "node:crypto";
import { isPgliteCheckpointFailure, pgliteRecoverySteps } from "pstdio-api/pglite-recovery-hint";
import { createLogger, resolveDefaultLogPath } from "pstdio-logging";
import { runApi as defaultRunApi, shouldAutoStartApi } from "@/adapters/cli/dashboard/api";
import {
  isHealthy as defaultIsHealthy,
  waitForHealthy as defaultWaitForHealthy,
} from "@/adapters/cli/dashboard/health-check";
import { resolveDefaultDbPath } from "@/adapters/cli/dashboard/state-paths";
import { readStartupDiagnostics, resolveStartupLogOffset } from "./api-startup-diagnostics";

/**
 * Ensures the pstdio API server is running before CLI commands that need it.
 *
 * Checks the /healthz endpoint first — if the API is already up, returns immediately.
 * Otherwise spawns a detached API process in the background and waits until it becomes
 * healthy. Throws if the API cannot be started.
 *
 * Dependencies are injected so the module can be tested without spawning real processes.
 */

export type EnsureApiDeps = {
  isHealthy: typeof defaultIsHealthy;
  waitForHealthy: typeof defaultWaitForHealthy;
  runApi: typeof defaultRunApi;
};

const defaultDeps: EnsureApiDeps = {
  isHealthy: defaultIsHealthy,
  waitForHealthy: defaultWaitForHealthy,
  runApi: defaultRunApi,
};

const API_HEALTH_TIMEOUT_MS = 15_000;

const errorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error));

const startupLogger = () => createLogger({ component: "ensure-api", service: "pstdio", sync: true });

type ApiChild = NonNullable<ReturnType<EnsureApiDeps["runApi"]>>["child"];

class ApiChildStartupError extends Error {}

const monitorApiChild = (child: ApiChild, controller: AbortController) => {
  let failure: ApiChildStartupError | null = null;
  const onExit = (code: number | null, signal: NodeJS.Signals | null) => {
    const reason = code !== null ? `code ${code}` : signal ? `signal ${signal}` : "an unknown status";
    failure = new ApiChildStartupError(`API process exited with ${reason} before becoming healthy.`);
    rejectFailure?.(failure);
    controller.abort();
  };
  const onError = (error: Error) => {
    failure = new ApiChildStartupError(`API process failed before becoming healthy: ${error.message}`);
    rejectFailure?.(failure);
    controller.abort();
  };
  let rejectFailure: ((error: ApiChildStartupError) => void) | undefined;
  const promise = child.once
    ? new Promise<never>((_resolve, reject) => {
        rejectFailure = reject;
        child.once?.("exit", onExit);
        child.once?.("error", onError);
      })
    : new Promise<never>(() => {});

  const dispose = () => {
    child.off?.("exit", onExit);
    child.off?.("error", onError);
  };

  return { dispose, failure: () => failure, promise };
};

const checkpointRecoveryHint = (output: string) => {
  if (!isPgliteCheckpointFailure(output)) return "";

  const dbPath = process.env.PSTDIO_DB_PATH ?? resolveDefaultDbPath();
  return `\nDetected a PGlite checkpoint/WAL startup failure at ${dbPath}. ${pgliteRecoverySteps(dbPath)}.`;
};

const formatStartupDiagnostics = (diagnostics: string) =>
  diagnostics ? `\nAPI startup diagnostics:\n${diagnostics}${checkpointRecoveryHint(diagnostics)}` : "";

const apiStartupError = (detail: string, data: Record<string, unknown> = {}) => {
  const error = new Error(`Could not start the pstdio API. ${detail} Logs: ${resolveDefaultLogPath()}`);
  startupLogger().error({ ...data, event: "api.autostart.failed", message: error.message }, "API auto-start failed");
  return error;
};

export const ensureApi = async (apiUrl: string, deps: EnsureApiDeps = defaultDeps) => {
  const healthUrl = `${apiUrl}/healthz`;

  if (await deps.isHealthy(healthUrl)) return;

  if (!shouldAutoStartApi(process.env)) {
    throw apiStartupError("API auto-start is disabled (PSTDIO_DISABLE_API_AUTO_START=1); run `pstdio serve`.");
  }

  const autostartId = randomUUID();
  const logPath = resolveDefaultLogPath();
  const logOffset = resolveStartupLogOffset(logPath);
  let result: ReturnType<EnsureApiDeps["runApi"]>;
  try {
    result = deps.runApi(process.cwd(), {
      stdio: "ignore",
      detached: true,
      env: { ...process.env, PSTDIO_AUTOSTART_ID: autostartId },
    });
  } catch (error) {
    throw apiStartupError(`API process failed to spawn: ${errorMessage(error)}. Run \`pstdio serve\`.`);
  }

  if (!result) {
    throw apiStartupError("API process could not be launched; run `pstdio serve`.");
  }

  const controller = new AbortController();
  const childMonitor = monitorApiChild(result.child, controller);
  try {
    await Promise.race([
      deps.waitForHealthy({ url: healthUrl, timeoutMs: API_HEALTH_TIMEOUT_MS, signal: controller.signal }),
      childMonitor.promise,
    ]);
    childMonitor.dispose();
  } catch (error) {
    controller.abort();
    childMonitor.dispose();
    const childFailure = childMonitor.failure();
    if (!childFailure) result.child.kill?.();

    const failure = childFailure ?? error;
    const diagnostics = readStartupDiagnostics({ autostartId, logPath, offset: logOffset });
    const detail = childFailure ? childFailure.message : `API did not become healthy in 15s. ${errorMessage(failure)}`;
    throw apiStartupError(`${detail}${formatStartupDiagnostics(diagnostics)}`, {
      autostartId,
      diagnostics,
    });
  }
};
