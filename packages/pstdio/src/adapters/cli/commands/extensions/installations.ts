import type { Arguments, Argv } from "yargs";
import { apiClient } from "@/features/api-client";

export const command = "installations [id]";
export const describe = "List extension installation jobs, or retry a failed job by ID";
export const builder = (yargs: Argv) =>
  yargs.positional("id", { type: "string", describe: "Failed installation ID to retry" });
export const handler = async (argv: Arguments<{ id?: string }>) => {
  const extensions = apiClient().extensions;
  console.log(JSON.stringify(argv.id ? await extensions.retryInstallation(argv.id) : await extensions.installations()));
};
