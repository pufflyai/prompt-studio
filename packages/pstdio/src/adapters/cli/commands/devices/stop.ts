import type { Arguments, Argv } from "yargs";
import { apiClient } from "@/features/api-client";
export const command = "stop <id>";
export const describe = "Request graceful cloud-device shutdown; retained provider resources remain billable";
export const builder = (yargs: Argv) => yargs.positional("id", { type: "string", demandOption: true });
export const handler = async (args: Arguments<{ id: string }>) =>
  console.log(JSON.stringify(await apiClient().account.stopCloudDevice(args.id), null, 2));
