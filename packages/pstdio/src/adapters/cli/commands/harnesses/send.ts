import type { Arguments, Argv } from "yargs";
import { sendHarnessSession } from "@/features/harnesses/api/send-harness-session";
import { parseVars } from "../parse-vars";

export const command = "send";
export const describe = "Send a follow-up prompt to a harness session";

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
    .option("harness", { type: "string", describe: "Switch harness for this follow-up" })
    .option("model", { type: "string", describe: "Model override" });

type SendArgs = {
  id: string;
  prompt?: string;
  template?: string;
  var?: string[];
  "summary-of"?: string;
  "summary-format"?: "brief" | "detailed";
  "summary-role"?: "assistant" | "all";
  harness?: string;
  model?: string;
};

export const handler = async (argv: Arguments<SendArgs>) => {
  if (!argv.prompt && !argv.template && !argv["summary-of"]) {
    throw new Error("At least one of --prompt, --template, or --summary-of is required.");
  }
  if (argv.prompt && argv.template) throw new Error("--prompt and --template are mutually exclusive");

  const session = await sendHarnessSession(argv.id, {
    prompt: argv.prompt,
    template: argv.template,
    vars: parseVars(argv.var),
    harness: argv.harness,
    model: argv.model,
    summary_from_session_id: argv["summary-of"],
    summary_format: argv["summary-format"],
    summary_role: argv["summary-role"],
  });

  console.log(
    [
      `Sent to harness session ${session.id}`,
      `Harness: ${session.agent ?? "unknown"}`,
      `Status:  ${session.status}`,
    ].join("\n"),
  );
};
