import type { Argv } from "yargs";
import { createNotificationsApi } from "./client";
import { parseSnoozeUntil } from "./format";
import { resolveProjectId } from "./project";

export const command = "snooze <id>";
export const describe = "Snooze a notification until a deadline";

export const builder = (yargs: Argv) =>
  yargs
    .positional("id", { type: "string", demandOption: true })
    .option("project-id", { type: "string", describe: "Project ID" })
    .option("until", { type: "string", demandOption: true, describe: "ISO timestamp or relative duration like 1h" });

type Args = {
  id: string;
  "project-id"?: string;
  until: string;
};

export const createHandler =
  (deps?: { api?: ReturnType<typeof createNotificationsApi>; log?: (message: string) => void }) =>
  async (argv: Args) => {
    const api = deps?.api ?? createNotificationsApi();
    const until = parseSnoozeUntil(argv.until);
    const notification = await api.snooze(resolveProjectId(argv["project-id"]), argv.id, until);
    (deps?.log ?? console.log)(`Snoozed notification ${notification.id} until ${until}`);
  };

export const handler = createHandler();
