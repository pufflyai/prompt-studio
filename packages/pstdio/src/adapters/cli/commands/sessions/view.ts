import type { Arguments, Argv } from "yargs";
import { API_URL } from "@/features/api-url";
import { getSession as defaultGetSession } from "@/features/sessions/api/get-session";

export const command = "view";
export const describe = "View session details";

export const builder = (yargs: Argv) =>
  yargs.option("id", { type: "string", demandOption: true, describe: "Session ID" });

export type ViewArgs = { id: string };

type Deps = {
  getSession: typeof defaultGetSession;
  log: (msg: string) => void;
};

const defaultDeps: Deps = {
  getSession: defaultGetSession,
  log: console.log,
};

export const createHandler =
  (deps: Deps = defaultDeps) =>
  async (argv: Arguments<ViewArgs>) => {
    const session = await deps.getSession(API_URL, argv.id);
    if (!session) throw new Error(`Session not found: ${argv.id}`);

    const lines = [
      `Session:     ${session.id}`,
      `Status:      ${session.status}`,
      `Agent:       ${session.agent ?? "-"}`,
    ];

    if (session.created) lines.push(`Started:     ${session.created}`);
    if (session.last_request_ended) lines.push(`Finished:    ${session.last_request_ended}`);

    deps.log(lines.join("\n"));
  };

export const handler = createHandler();
