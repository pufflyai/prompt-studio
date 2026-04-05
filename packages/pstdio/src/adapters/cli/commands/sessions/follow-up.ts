import type { Arguments, Argv } from "yargs";
import { followUpSession as defaultFollowUp } from "@/features/sessions/api/follow-up-session";
import { parseVars } from "./parse-vars";

export const command = "follow-up";
export const describe = "Send a follow-up prompt to an existing session";

export const builder = (yargs: Argv) =>
  yargs
    .option("id", { type: "string", demandOption: true, describe: "Session ID" })
    .option("prompt", { type: "string", describe: "The follow-up prompt" })
    .option("template", { type: "string", describe: "Prompt template name (mutually exclusive with --prompt)" })
    .option("var", { type: "string", array: true, describe: "Template variable in key=value format" })
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
  template?: string;
  var?: string[];
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

const buildFollowUpInput = (argv: Arguments<FollowUpArgs>) => {
  if (!argv.prompt && !argv.template && !argv["summary-of"]) {
    throw new Error("At least one of --prompt, --template, or --summary-of is required.");
  }
  if (argv.prompt && argv.template) {
    throw new Error("--prompt and --template are mutually exclusive");
  }

  const input: Record<string, string | Record<string, string> | undefined> = {};
  if (argv.prompt) input.prompt = argv.prompt;
  if (argv.template) input.template = argv.template;
  const vars = parseVars(argv.var);
  if (vars) input.vars = vars;
  if (argv.agent) input.agent = argv.agent;
  if (argv.model) input.model = argv.model;
  if (argv["summary-of"]) input.summary_from_session_id = argv["summary-of"];
  if (argv["summary-format"]) input.summary_format = argv["summary-format"];
  if (argv["summary-role"]) input.summary_role = argv["summary-role"];
  return input;
};

export const createHandler =
  (deps: Deps = defaultDeps) =>
  async (argv: Arguments<FollowUpArgs>) => {
    const input = buildFollowUpInput(argv);
    const result = await deps.followUpSession(argv.id, input);

    const lines = [`Follow-up sent to session ${result.id}`];
    lines.push(`Agent:  ${result.agent ?? "unknown"}`);
    lines.push(`Status: ${result.status}`);
    deps.log(lines.join("\n"));
  };

export const handler = createHandler();
