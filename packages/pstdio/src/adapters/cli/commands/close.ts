import type { Argv } from "yargs";
import { isHealthy } from "@/adapters/cli/dashboard/health-check";
import { shutdownApi } from "@/features/api/shutdown";
import { API_URL } from "@/features/api-url";

export const command = "close";
export const describe = "Stop the background API process";

export const builder = (yargs: Argv) => yargs;

export const handler = async () => {
  if (!(await isHealthy(`${API_URL}/healthz`))) {
    process.stdout.write("API is not running.\n");
    return;
  }

  const success = await shutdownApi(API_URL);

  if (success) {
    process.stdout.write("API stopped.\n");
  } else {
    process.stderr.write("Failed to stop the API.\n");
    process.exit(1);
  }
};
