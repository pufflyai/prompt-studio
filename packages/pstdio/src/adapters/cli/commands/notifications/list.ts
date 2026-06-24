import type { Argv } from "yargs";
import { createNotificationsApi } from "./client";
import { formatNotificationsTable } from "./format";
import { resolveProjectId } from "./project";

export const command = "list";
export const describe = "List pending notifications";

export const builder = (yargs: Argv) =>
  yargs
    .option("project-id", { type: "string", describe: "Project ID" })
    .option("status", { type: "string", describe: "Notification status filter" })
    .option("priority", { type: "string", describe: "Notification priority filter" })
    .option("limit", { type: "number", describe: "Maximum rows to print" });

type Args = {
  "project-id"?: string;
  status?: string;
  priority?: string;
  limit?: number;
};

type Deps = {
  api: ReturnType<typeof createNotificationsApi>;
  log: (message: string) => void;
};

export const createHandler = (deps?: Partial<Deps>) => async (argv: Args) => {
  const api = deps?.api ?? createNotificationsApi();
  const projectId = resolveProjectId(argv["project-id"]);
  const result = await api.list(projectId, {
    status: argv.status?.split(",") as never,
    priority: argv.priority?.split(",") as never,
    limit: argv.limit,
  });

  if (result.items.length === 0) {
    (deps?.log ?? console.log)("No pending notifications.");
    return;
  }

  (deps?.log ?? console.log)(formatNotificationsTable(result.items));
};

export const handler = createHandler();
