import type { Argv } from "yargs";
import { createNotificationsApi } from "./client";
import { formatNotificationDetails } from "./format";
import { resolveProjectId } from "./project";

export const command = "show <id>";
export const describe = "Show a notification";

export const builder = (yargs: Argv) =>
  yargs.positional("id", { type: "string", demandOption: true }).option("project-id", {
    type: "string",
    describe: "Project ID",
  });

type Args = {
  id: string;
  "project-id"?: string;
};

export const createHandler =
  (deps?: { api?: ReturnType<typeof createNotificationsApi>; log?: (message: string) => void }) =>
  async (argv: Args) => {
    const api = deps?.api ?? createNotificationsApi();
    const notification = await api.get(resolveProjectId(argv["project-id"]), argv.id);
    (deps?.log ?? console.log)(formatNotificationDetails(notification));
  };

export const handler = createHandler();
