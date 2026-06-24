import type { NotificationKind, NotificationPriority } from "@pstdio/sdk/api";
import type { Argv } from "yargs";
import { createNotificationsApi } from "./client";
import { parseNotificationTarget } from "./format";

export const command = "send";
export const describe = "Create a notification";

export const builder = (yargs: Argv) =>
  yargs
    .option("project-id", { type: "string", demandOption: true, describe: "Project ID" })
    .option("kind", { type: "string", demandOption: true, describe: "Notification kind" })
    .option("title", { type: "string", demandOption: true, describe: "Notification title" })
    .option("body", { type: "string", describe: "Notification body" })
    .option("priority", { type: "string", describe: "Notification priority" })
    .option("target", { type: "string", describe: "Resource target as type:id" })
    .option("dedupe-key", { type: "string", describe: "Producer dedupe key" });

type Args = {
  "project-id": string;
  kind: string;
  title: string;
  body?: string;
  priority?: string;
  target?: string;
  "dedupe-key"?: string;
};

export const createHandler =
  (deps?: { api?: ReturnType<typeof createNotificationsApi>; log?: (message: string) => void }) =>
  async (argv: Args) => {
    const api = deps?.api ?? createNotificationsApi();
    const notification = await api.create({
      projectId: argv["project-id"],
      kind: argv.kind as NotificationKind,
      title: argv.title,
      body: argv.body,
      priority: argv.priority as NotificationPriority | undefined,
      target: argv.target ? parseNotificationTarget(argv.target) : undefined,
      dedupeKey: argv["dedupe-key"],
    });

    (deps?.log ?? console.log)(`Created notification ${notification.id}`);
  };

export const handler = createHandler();
