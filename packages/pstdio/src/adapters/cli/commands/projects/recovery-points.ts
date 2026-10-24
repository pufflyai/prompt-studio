import type { Arguments, Argv } from "yargs";
import { apiClient } from "@/features/api-client";

export const command = "recovery-points <id>";
export const describe = "List this device's recovery points for a cloud project, with their capture times";
export const builder = (yargs: Argv) =>
  yargs.positional("id", { type: "string", demandOption: true, describe: "Project ID" });
export const handler = async (args: Arguments<{ id: string }>) => {
  console.log(JSON.stringify(await apiClient().projects.recoveryPoints(args.id), null, 2));
};
