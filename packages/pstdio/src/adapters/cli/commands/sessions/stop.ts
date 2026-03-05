import type { Arguments, Argv } from "yargs";
import { API_URL } from "@/features/api-url";
import { getSession as defaultGetSession } from "@/features/sessions/api/get-session";
import { updateSessionStatus as defaultUpdateSessionStatus } from "@/features/sessions/api/update-session-status";

export const command = "stop";
export const describe = "Gracefully stop a running session";

export const builder = (yargs: Argv) =>
  yargs.option("id", { type: "string", demandOption: true, describe: "Session ID" });

type StopArgs = { id: string };

type Deps = {
  getSession: typeof defaultGetSession;
  updateSessionStatus: typeof defaultUpdateSessionStatus;
  log: (msg: string) => void;
};

const defaultDeps: Deps = {
  getSession: defaultGetSession,
  updateSessionStatus: defaultUpdateSessionStatus,
  log: console.log,
};

export const createHandler =
  (deps: Deps = defaultDeps) =>
  async (argv: Arguments<StopArgs>) => {
    const session = await deps.getSession(API_URL, argv.id);
    if (!session) throw new Error(`Session not found: ${argv.id}`);

    if (session.status !== "in_progress" && session.status !== "awaiting_input") {
      throw new Error(`Session is not running`);
    }

    await deps.updateSessionStatus(API_URL, argv.id, "cancelled");
    deps.log(`Stopped session ${argv.id}.`);
  };

export const handler = createHandler();
