import type { Arguments, Argv } from "yargs";
import { apiClient } from "@/features/api-client";

export const command = "local <id>";
export const describe = "Stop syncing a cloud project. Every device keeps its local copy.";
export const builder = (yargs: Argv) =>
  yargs.positional("id", { type: "string", demandOption: true, describe: "Project ID" });
export const handler = async (args: Arguments<{ id: string }>) => {
  await apiClient().account.stopProjectSync(args.id);
  console.log(`Project ${args.id} no longer syncs.`);
};
