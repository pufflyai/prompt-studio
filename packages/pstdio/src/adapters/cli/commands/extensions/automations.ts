import { createRequest } from "@pstdio/sdk/client";
import type { Arguments, Argv } from "yargs";
import { resolveApiUrl } from "@/features/api-url";
import { resolveProjectId } from "@/features/projects/resolve-project-id";

export const command = "automations <action> [schedule]";
export const describe = "Assign a shared schedule to this environment, switch it, or inspect delivery and local runs";
export const builder = (yargs: Argv) =>
  yargs
    .positional("action", { choices: ["list", "runs", "assign", "enable", "disable"] as const, demandOption: true })
    .positional("schedule", { type: "string", describe: "Full schedule ID" })
    .option("project-id", { type: "string", describe: "Workbench project ID" })
    .option("workspace-id", { type: "string", describe: "Local workspace used by this schedule" })
    .option("expected-revision", { type: "string", describe: "Observed automation revision" });
interface Args {
  action: "list" | "runs" | "assign" | "enable" | "disable";
  schedule?: string;
  "project-id"?: string;
  "workspace-id"?: string;
  "expected-revision"?: string;
}
export const handler = async (argv: Arguments<Args>) => {
  const { projectId } = resolveProjectId(process.cwd(), argv["project-id"]);
  const request = createRequest({ baseUrl: resolveApiUrl(), token: process.env.PSTDIO_API_TOKEN });
  const path = `/v1/projects/${encodeURIComponent(projectId)}/automation-targets`;
  if (argv.action === "list" || argv.action === "runs") {
    console.log(JSON.stringify(await request(argv.action === "runs" ? `${path}/runs` : path), null, 2));
    return;
  }
  if (!argv.schedule) throw new Error("Choose a full schedule ID.");
  let body: unknown;
  if (argv.action === "assign") {
    if (!argv["workspace-id"]) throw new Error("Choose a local workspace with --workspace-id.");
    body = { kind: "assign", scheduleId: argv.schedule, workspaceId: argv["workspace-id"] };
  } else {
    if (!argv["expected-revision"]) throw new Error("Read the automation and pass --expected-revision.");
    body = {
      kind: "enabled",
      scheduleId: argv.schedule,
      enabled: argv.action === "enable",
      expectedRevision: argv["expected-revision"],
    };
  }
  console.log(JSON.stringify(await request(path, { method: "POST", body }), null, 2));
};
