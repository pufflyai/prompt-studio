import { runApi as defaultRunApi } from "@/adapters/cli/dashboard/api";
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

export const ensureApi = async (apiUrl: string, deps: EnsureApiDeps = defaultDeps) => {
  const healthUrl = `${apiUrl}/healthz`;

  if (await deps.isHealthy(healthUrl)) return;

  const result = deps.runApi(process.cwd(), {
    stdio: "ignore",
    detached: true,
    env: process.env,
  });

  if (!result) {
    throw new Error("Could not start the pstdio API. Start it manually or check your installation.");
  }

  await deps.waitForHealthy({ url: healthUrl });
};
