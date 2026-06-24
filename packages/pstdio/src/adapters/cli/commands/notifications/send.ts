import type { CreateNotificationInput, NotificationKind, NotificationPriority } from "@pstdio/sdk/api";
import type { Argv } from "yargs";
import { sendNotification as defaultSend } from "@/features/notifications/api/notifications-api";
import { parseActions, parseRelatedRefs, parseResourceRef } from "@/features/notifications/cli/parse-resource";

type Deps = {
  sendNotification: typeof defaultSend;
  log: (msg: string) => void;
};

const defaultDeps: Deps = {
  sendNotification: defaultSend,
  log: console.log,
};

interface Args {
  "project-id": string;
  kind?: string;
  title?: string;
  body?: string;
  priority?: string;
  target?: string;
  related?: string | string[];
  action?: string | string[];
  "dedupe-key"?: string;
  json?: string;
}

export const command = "send";
export const describe = "Create or upsert a notification";

export const builder = (yargs: Argv) =>
  yargs
    .option("project-id", { type: "string", demandOption: true })
    .option("kind", { type: "string", describe: "needs_review | ready_to_merge | blocked | …" })
    .option("title", { type: "string" })
    .option("body", { type: "string" })
    .option("priority", { type: "string" })
    .option("target", { type: "string", describe: "<type>:<id>" })
    .option("related", { type: "string", array: true })
    .option("action", { type: "string", array: true })
    .option("dedupe-key", { type: "string" })
    .option("json", { type: "string", describe: "Full CreateNotificationInput body" });

const buildInputFromArgs = (args: Args): CreateNotificationInput => {
  if (!args.kind) throw new Error("--kind is required (or use --json)");
  if (!args.title) throw new Error("--title is required (or use --json)");
  return {
    projectId: args["project-id"],
    kind: args.kind as NotificationKind,
    title: args.title,
    body: args.body,
    priority: args.priority as NotificationPriority | undefined,
    target: args.target ? parseResourceRef(args.target) : undefined,
    related: parseRelatedRefs(args.related),
    actions: parseActions(args.action),
    dedupeKey: args["dedupe-key"],
  };
};

export const createHandler =
  (deps: Deps = defaultDeps) =>
  async (args: Args) => {
    let input: CreateNotificationInput;
    if (args.json) {
      const parsed = JSON.parse(args.json) as CreateNotificationInput;
      input = { ...parsed, projectId: parsed.projectId ?? args["project-id"] };
    } else {
      input = buildInputFromArgs(args);
    }
    const result = await deps.sendNotification(input);
    deps.log(result.id);
  };

export const handler = createHandler();
