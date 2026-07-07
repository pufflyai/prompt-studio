import { createLogger, resolveDefaultLogPath } from "pstdio-logging";
import { runApi as defaultRunApi, shouldAutoStartApi } from "@/adapters/cli/dashboard/api";
import {
  isHealthy as defaultIsHealthy,
  waitForHealthy as defaultWaitForHealthy,
} from "@/adapters/cli/dashboard/health-check";

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
const OUTPUT_TAIL_BYTES = 8_192;

const errorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error));

const startupLogger = () => createLogger({ component: "ensure-api", service: "pstdio", sync: true });

const appendOutput = (current: string, chunk: Buffer | string) => {
  const next = current + chunk.toString();
  return next.length > OUTPUT_TAIL_BYTES ? next.slice(next.length - OUTPUT_TAIL_BYTES) : next;
};

const unrefStream = (stream: unknown) => {
  if (stream && typeof stream === "object" && "unref" in stream && typeof stream.unref === "function") {
    stream.unref();
  }
};

type ApiChild = NonNullable<ReturnType<EnsureApiDeps["runApi"]>>["child"];

const captureProcessOutput = (child: ApiChild | undefined) => {
  let stdout = "";
  let stderr = "";
  child?.stdout?.on?.("data", (chunk) => {
    stdout = appendOutput(stdout, chunk);
  });
  child?.stderr?.on?.("data", (chunk) => {
    stderr = appendOutput(stderr, chunk);
  });
  unrefStream(child?.stdout);
  unrefStream(child?.stderr);

  return () => ({ stdout: stdout.trim(), stderr: stderr.trim() });
};

const checkpointRecoveryHint = (output: string) => {
  if (!/could not locate a valid checkpoint record|Aborted\(\)/i.test(output)) return "";

  const dbPath = process.env.PSTDIO_DB_PATH ?? "the configured pstdio database path";
  return `\nDetected a PGlite checkpoint/WAL startup failure at ${dbPath}. Data is often recoverable with pg_resetwal; see .pstdio/docs/lessons-learned/pglite_wal_corruption.md.`;
};

const formatCapturedOutput = (output: { stdout: string; stderr: string }) => {
  const parts = [];
  if (output.stderr) parts.push(`stderr:\n${output.stderr}`);
  if (output.stdout) parts.push(`stdout:\n${output.stdout}`);
  if (parts.length === 0) return "";

  const text = parts.join("\n");
  return `\nCaptured API process output:\n${text}${checkpointRecoveryHint(text)}`;
};

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

  let result: ReturnType<EnsureApiDeps["runApi"]>;
  try {
    result = deps.runApi(process.cwd(), {
      stdio: "pipe",
      detached: true,
      env: process.env,
    });
  } catch (error) {
    throw apiStartupError(`API process failed to spawn: ${errorMessage(error)}. Run \`pstdio serve\`.`);
  }

  if (!result) {
    throw apiStartupError("API process could not be launched; run `pstdio serve`.");
  }
  const readCapturedOutput = captureProcessOutput(result.child);

  try {
    await deps.waitForHealthy({ url: healthUrl, timeoutMs: API_HEALTH_TIMEOUT_MS });
  } catch (error) {
    const output = readCapturedOutput();
    throw apiStartupError(`API did not become healthy in 15s. ${errorMessage(error)}${formatCapturedOutput(output)}`, {
      stderr: output.stderr,
      stdout: output.stdout,
    });
  }
};
