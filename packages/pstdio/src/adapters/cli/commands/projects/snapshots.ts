import type { Arguments, Argv } from "yargs";
import { apiClient } from "@/features/api-client";

export const command = "snapshots <id>";
export const describe = "List this device's recovery snapshots for a cloud project";
export const builder = (yargs: Argv) =>
  yargs.positional("id", { type: "string", demandOption: true, describe: "Project ID" });
export const handler = async (args: Arguments<{ id: string }>) => {
  console.log(JSON.stringify(await apiClient().projects.snapshots(args.id), null, 2));
};
