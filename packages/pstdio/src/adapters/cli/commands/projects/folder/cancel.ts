import type { Arguments, Argv } from "yargs";
import { apiClient } from "@/features/api-client";

export const command = "cancel <id>";
export const describe = "Cancel the running folder download or restore; only its staging is removed";
export const builder = (yargs: Argv) =>
  yargs.positional("id", { type: "string", demandOption: true, describe: "Project ID" });
export const handler = async (args: Arguments<{ id: string }>) => {
  console.log(JSON.stringify(await apiClient().projects.cancelFolderRecovery(args.id), null, 2));
};
