import type { Arguments, Argv } from "yargs";
import { apiClient } from "@/features/api-client";

export const command = "status <id>";
export const describe = "Show folder capture, download and restore progress on this device";
export const builder = (yargs: Argv) =>
  yargs.positional("id", { type: "string", demandOption: true, describe: "Project ID" });
export const handler = async (args: Arguments<{ id: string }>) => {
  console.log(JSON.stringify(await apiClient().projects.folderRecovery(args.id), null, 2));
};
