import { createRequest } from "@pstdio/sdk/client";
import type { Arguments, Argv } from "yargs";
import { resolveApiUrl } from "@/features/api-url";
import { resolveProjectId } from "@/features/projects/resolve-project-id";

export const command = "automations <action> [schedule]";
export const describe = "Assign an automation to one device or inspect assignments and local runs";
export const builder = (yargs: Argv) =>
  yargs
    .positional("action", { choices: ["list", "runs", "assign"] as const, demandOption: true })
    .positional("schedule", { type: "string", describe: "Full schedule ID" })
    .option("project-id", { type: "string", describe: "Project ID" })
    .option("device-id", { type: "string", describe: "Device that will run the automation" });
interface Args {
  action: "list" | "runs" | "assign";
  schedule?: string;
  "project-id"?: string;
  "device-id"?: string;
}
export const handler = async (argv: Arguments<Args>) => {
  const { projectId } = resolveProjectId(process.cwd(), argv["project-id"]);
  const request = createRequest({ baseUrl: resolveApiUrl(), token: process.env.PSTDIO_API_TOKEN });
  const path = `/v1/projects/${encodeURIComponent(projectId)}/extensions/automations`;
  if (argv.action !== "assign") {
    console.log(JSON.stringify(await request(argv.action === "runs" ? `${path}/runs` : path), null, 2));
    return;
  }
  if (!argv.schedule || !argv["device-id"]) throw new Error("Choose a full schedule ID and --device-id.");
  console.log(
    JSON.stringify(
      await request(path, {
        method: "POST",
        body: {
          scheduleId: argv.schedule,
          deviceId: argv["device-id"],
        },
      }),
      null,
      2,
    ),
  );
};
