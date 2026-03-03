import { runApi as defaultRunApi } from "@/adapters/cli/dashboard/api";
import {
  isHealthy as defaultIsHealthy,
  waitForHealthy as defaultWaitForHealthy,
} from "@/adapters/cli/dashboard/health-check";

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
