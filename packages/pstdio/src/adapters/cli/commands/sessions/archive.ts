import type { Arguments, Argv } from "yargs";
import { API_URL } from "@/features/api-url";
import { archiveSession as defaultArchiveSession } from "@/features/sessions/api/archive-session";

export const command = "archive";
export const describe = "Archive a session";

export const builder = (yargs: Argv) =>
  yargs.option("id", { type: "string", demandOption: true, describe: "Session ID" });

type ArchiveArgs = { id: string };

type Deps = {
  archiveSession: typeof defaultArchiveSession;
  log: (msg: string) => void;
};

const defaultDeps: Deps = {
  archiveSession: defaultArchiveSession,
  log: console.log,
};

export const createHandler =
  (deps: Deps = defaultDeps) =>
  async (argv: Arguments<ArchiveArgs>) => {
    await deps.archiveSession(API_URL, argv.id);
    deps.log(`Archived session ${argv.id}`);
  };

export const handler = createHandler();
