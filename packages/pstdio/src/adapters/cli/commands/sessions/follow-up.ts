import type { Arguments, Argv } from "yargs";
import { API_URL } from "@/features/api-url";
import { followUpSession as defaultFollowUp } from "@/features/sessions/api/follow-up-session";

export const command = "follow-up";
export const describe = "Send a follow-up prompt to an existing session";

export const builder = (yargs: Argv) =>
  yargs
    .option("id", { type: "string", demandOption: true, describe: "Session ID" })
    .option("prompt", { type: "string", describe: "The follow-up prompt" })
    .option("summary-of", { type: "string", describe: "Source session ID to summarize" })
    .option("summary-format", {
      type: "string",
      choices: ["brief", "detailed"] as const,
      describe: "Summary format (default: brief)",
    })
    .option("summary-role", {
      type: "string",
      choices: ["assistant", "all"] as const,
      describe: "Which roles to include in summary (default: assistant)",
    })
    .option("agent", { type: "string", describe: "Switch agent for this follow-up" })
    .option("model", { type: "string", describe: "Model override" });

export type FollowUpArgs = {
  id: string;
  prompt?: string;
  "summary-of"?: string;
  "summary-format"?: "brief" | "detailed";
  "summary-role"?: "assistant" | "all";
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
    if (!argv.prompt && !argv["summary-of"]) {
      throw new Error("At least one of --prompt or --summary-of is required.");
    }

    const input: Record<string, string | undefined> = {};
    if (argv.prompt) input.prompt = argv.prompt;
    if (argv.agent) input.agent = argv.agent;
    if (argv.model) input.model = argv.model;
    if (argv["summary-of"]) input.summary_from_session_id = argv["summary-of"];
    if (argv["summary-format"]) input.summary_format = argv["summary-format"];
    if (argv["summary-role"]) input.summary_role = argv["summary-role"];

    const result = await deps.followUpSession(API_URL, argv.id, input);

    const lines = [`Follow-up sent to session ${result.id}`];
    lines.push(`Agent:  ${result.agent ?? "unknown"}`);
    lines.push(`Status: ${result.status}`);
    deps.log(lines.join("\n"));
  };

export const handler = createHandler();
