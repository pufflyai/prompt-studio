import type { Arguments, Argv } from "yargs";
import { apiClient } from "@/features/api-client";

export const command = "remove <id>";
export const describe = "Remove a device from your account. It stops syncing; its local data stays.";
export const builder = (yargs: Argv) =>
  yargs.positional("id", { type: "string", demandOption: true, describe: "Device ID from pst devices list" });
export const handler = async (args: Arguments<{ id: string }>) => {
  await apiClient().account.removeDevice(args.id);
  console.log(`Removed ${args.id}.`);
};
