import { resolve } from "node:path";
import type { Arguments, Argv } from "yargs";
import { apiClient } from "@/features/api-client";

export const command = "bind <id>";
export const describe = "Bind an existing workbench identity to a folder in this environment";
export const builder = (yargs: Argv) =>
  yargs
    .positional("id", { type: "string", demandOption: true, describe: "Existing workbench (project) ID" })
    .option("environment", { type: "string", demandOption: true, describe: "Expected local environment ID" })
    .option("name", { type: "string", demandOption: true, describe: "Workbench name on first binding" })
    .option("path", { type: "string", demandOption: true, describe: "Existing local folder" });

export const handler = async (argv: Arguments<{ id: string; environment: string; name: string; path: string }>) => {
  const binding = await apiClient().projects.bindEnvironment(argv.id, {
    environmentId: argv.environment,
    name: argv.name,
    initial_workspace: { provider_id: "pstdio.root", params: { path: resolve(argv.path) } },
  });
  console.log(JSON.stringify(binding));
};
