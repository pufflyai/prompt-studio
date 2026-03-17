import type { Arguments, Argv } from "yargs";
import { API_URL } from "@/features/api-url";
import { followUpSession as defaultFollowUp } from "@/features/sessions/api/follow-up-session";

export const command = "follow-up";
export const describe = "Send a follow-up prompt to an existing session";

export const builder = (yargs: Argv) =>
  yargs
    .option("id", { type: "string", demandOption: true, describe: "Session ID" })
    .option("prompt", { type: "string", demandOption: true, describe: "The follow-up prompt" })
    .option("agent", { type: "string", describe: "Switch agent for this follow-up" })
    .option("model", { type: "string", describe: "Model override" });

export type FollowUpArgs = {
  id: string;
  prompt: string;
  agent?: string;
  model?: string;
};

type Deps = {
  followUpSession: typeof defaultFollowUp;
  log: (msg: string) => void;
};

const defaultDeps: Deps = {
  followUpSession: defaultFollowUp,
  log: console.log,
};

export const createHandler =
  (deps: Deps = defaultDeps) =>
  async (argv: Arguments<FollowUpArgs>) => {
    const result = await deps.followUpSession(API_URL, argv.id, {
      prompt: argv.prompt,
      agent: argv.agent,
      model: argv.model,
    });

    const lines = [`Follow-up sent to session ${result.id}`];
    lines.push(`Agent:  ${result.agent ?? "unknown"}`);
    lines.push(`Status: ${result.status}`);
    deps.log(lines.join("\n"));
  };

export const handler = createHandler();
