import type { Arguments, Argv } from "yargs";
import { apiClient } from "@/features/api-client";
export const command = "start [id]";
export const describe = "Start a user-paid cloud device; omit id and supply --name to create one";
export const builder = (yargs: Argv) =>
  yargs.positional("id", { type: "string" }).option("name", { type: "string", describe: "Name for a new device" });
export const handler = async (args: Arguments<{ id?: string; name?: string }>) => {
  if (Boolean(args.id) === Boolean(args.name)) throw new Error("Supply a device id or --name for a new device.");
  const input = args.id ? { id: args.id } : { name: args.name! };
  console.log(JSON.stringify(await apiClient().account.startCloudDevice(input), null, 2));
};
