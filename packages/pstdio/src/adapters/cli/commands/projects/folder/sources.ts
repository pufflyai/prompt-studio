import type { Arguments, Argv } from "yargs";
import { apiClient } from "@/features/api-client";

export const command = "sources <id>";
export const describe = "List the folder copies your devices completed, with sizes, capture times and availability";
export const builder = (yargs: Argv) =>
  yargs.positional("id", { type: "string", demandOption: true, describe: "Project ID" });
export const handler = async (args: Arguments<{ id: string }>) => {
  console.log(JSON.stringify(await apiClient().projects.folderSources(args.id), null, 2));
};
