import type { Arguments, Argv } from "yargs";
import { apiClient } from "@/features/api-client";

export const command = "capture <id>";
export const describe = "Capture this device's project folder now; it uploads when Cloud is reachable";
export const builder = (yargs: Argv) =>
  yargs.positional("id", { type: "string", demandOption: true, describe: "Project ID" });
export const handler = async (args: Arguments<{ id: string }>) => {
  console.log(JSON.stringify(await apiClient().projects.captureFolder(args.id), null, 2));
};
