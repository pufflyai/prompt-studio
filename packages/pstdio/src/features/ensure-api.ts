import { resolveDefaultLogPath } from "pstdio-logging";
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

const errorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error));

const apiStartupError = (detail: string) =>
  new Error(`Could not start the pstdio API. ${detail} Logs: ${resolveDefaultLogPath()}`);

export const ensureApi = async (apiUrl: string, deps: EnsureApiDeps = defaultDeps) => {
  const healthUrl = `${apiUrl}/healthz`;

  if (await deps.isHealthy(healthUrl)) return;

  if (!shouldAutoStartApi(process.env)) {
    throw apiStartupError("API auto-start is disabled (PSTDIO_DISABLE_API_AUTO_START=1); run `pstdio serve`.");
  }

  let result: ReturnType<EnsureApiDeps["runApi"]>;
  try {
    result = deps.runApi(process.cwd(), {
      stdio: "ignore",
      detached: true,
      env: process.env,
    });
  } catch (error) {
    throw apiStartupError(`API process failed to spawn: ${errorMessage(error)}. Run \`pstdio serve\`.`);
  }

  if (!result) {
    throw apiStartupError("API process could not be launched; run `pstdio serve`.");
  }

  try {
    await deps.waitForHealthy({ url: healthUrl, timeoutMs: API_HEALTH_TIMEOUT_MS });
  } catch (error) {
    throw apiStartupError(`API did not become healthy in 15s. ${errorMessage(error)}`);
  }
};
