import type { Arguments, Argv } from "yargs";
import { apiClient } from "@/features/api-client";
export const command = "export-bootstrap [id]";
export const describe = "Write a private one-use enrollment file for Compose/Terraform, or an unenrolled cloud device";
export const builder = (yargs: Argv) =>
  yargs
    .positional("id", { type: "string" })
    .option("name", { type: "string", demandOption: true, describe: "Device name" });
export const handler = async (args: Arguments<{ id?: string; name: string }>) =>
  console.log(
    JSON.stringify(
      await apiClient().account.prepareCloudDeviceBootstrap({ name: args.name, ...(args.id ? { id: args.id } : {}) }),
      null,
      2,
    ),
  );
