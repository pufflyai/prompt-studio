import type { Arguments, Argv } from "yargs";
import { API_URL } from "@/features/api-url";
import { resolveSessionId as defaultResolveSessionId } from "@/features/sessions/api/resolve-session-id";

export const command = "resolve-session-id";
export const describe = "Resolve a pstdio session ID from an external agent session ID";

export const builder = (yargs: Argv) =>
  yargs
    .option("agent", {
      type: "string",
      demandOption: true,
      describe: "External agent ID",
    })
    .option("agent-session-id", {
      type: "string",
      demandOption: true,
      describe: "External agent session ID",
    })
    .option("cwd", {
      type: "string",
      describe: "Optional working directory used to break ties",
    })
    .option("json", {
      type: "boolean",
      default: false,
      describe: "Output as JSON",
    });

export type ResolveSessionIdArgs = {
  agent: string;
  "agent-session-id": string;
  cwd?: string;
  json: boolean;
};

type Deps = {
  resolveSessionId: typeof defaultResolveSessionId;
  log: (message: string) => void;
};

const defaultDeps: Deps = {
  resolveSessionId: defaultResolveSessionId,
  log: console.log,
};

export const createHandler =
  (deps: Deps = defaultDeps) =>
  async (argv: Arguments<ResolveSessionIdArgs>) => {
    const resolved = await deps.resolveSessionId(API_URL, {
      agent: argv.agent,
      agent_session_id: argv["agent-session-id"],
      cwd: argv.cwd,
    });

    if (argv.json) {
      deps.log(JSON.stringify(resolved, null, 2));
      return;
    }

    if (resolved.session_id) {
      deps.log(resolved.session_id);
      return;
    }

    deps.log("No matching session found.");
  };

export const handler = createHandler();
