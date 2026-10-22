import type { Arguments, Argv } from "yargs";
import { apiClient } from "@/features/api-client";

export const command = "cloud <id>";
export const describe = "Make a local project a cloud project. Your devices that have it sync it.";
export const builder = (yargs: Argv) =>
  yargs.positional("id", { type: "string", demandOption: true, describe: "Project ID" });
export const handler = async (args: Arguments<{ id: string }>) => {
  await apiClient().account.syncProject(args.id);
  console.log(`Project ${args.id} is now a cloud project.`);
};
