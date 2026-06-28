import type { Argv } from "yargs";
import { createNotificationsApi } from "./client";
import { resolveProjectId } from "./project";

type Args = {
  id: string;
  "project-id"?: string;
};

const builder = (yargs: Argv) =>
  yargs.positional("id", { type: "string", demandOption: true }).option("project-id", {
    type: "string",
    describe: "Project ID",
  });

export const createTransitionHandler =
  (
    action: "markRead" | "markDone" | "dismiss",
    label: string,
    deps?: { api?: ReturnType<typeof createNotificationsApi>; log?: (message: string) => void },
  ) =>
  async (argv: Args) => {
    const api = deps?.api ?? createNotificationsApi();
    const projectId = resolveProjectId(argv["project-id"]);
    const notification = await api[action](projectId, argv.id);
    (deps?.log ?? console.log)(`${label} notification ${notification.id}`);
  };

export const readCommand = {
  command: "read <id>",
  describe: "Mark a notification read",
  builder,
  handler: createTransitionHandler("markRead", "Read"),
};

export const doneCommand = {
  command: "done <id>",
  describe: "Mark a notification done",
  builder,
  handler: createTransitionHandler("markDone", "Done"),
};

export const dismissCommand = {
  command: "dismiss <id>",
  describe: "Dismiss a notification",
  builder,
  handler: createTransitionHandler("dismiss", "Dismissed"),
};
