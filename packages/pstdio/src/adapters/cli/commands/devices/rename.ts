import type { Arguments, Argv } from "yargs";
import { apiClient } from "@/features/api-client";

export const command = "rename <id> <name>";
export const describe = "Rename a device of your account";
export const builder = (yargs: Argv) =>
  yargs
    .positional("id", { type: "string", demandOption: true, describe: "Device ID from pst devices list" })
    .positional("name", { type: "string", demandOption: true, describe: "New device name" });
export const handler = async (args: Arguments<{ id: string; name: string }>) => {
  await apiClient().account.renameDevice(args.id, args.name);
  console.log(`Renamed ${args.id} to ${args.name}.`);
};
