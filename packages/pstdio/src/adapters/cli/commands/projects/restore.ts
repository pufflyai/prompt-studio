import { restoreProjectSchema } from "pstdio-api-contracts";
import type { Arguments, Argv } from "yargs";
import { apiClient } from "@/features/api-client";

export const command = "restore <id>";
export const describe = "Restore a cloud project, or one extension, to a listed recovery point";
export const builder = (yargs: Argv) =>
  yargs
    .positional("id", { type: "string", demandOption: true, describe: "Project ID" })
    .option("hours", {
      type: "number",
      choices: [1, 12, 24],
      demandOption: true,
      describe: "Recovery point period from projects recovery-points",
    })
    .option("captured-at", {
      type: "string",
      demandOption: true,
      describe: "Exact capture time from projects recovery-points",
    })
    .option("extension-id", { type: "string", describe: "Restore only this extension; omit for the whole project" });
export const handler = async (
  args: Arguments<{ id: string; hours: number; "captured-at": string; "extension-id"?: string }>,
) => {
  const input = restoreProjectSchema.parse({
    hours: args.hours,
    capturedAt: args["captured-at"],
    extensionId: args["extension-id"],
  });
  console.log(JSON.stringify(await apiClient().projects.restore(args.id, input), null, 2));
};
