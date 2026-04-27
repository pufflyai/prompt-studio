import type { Arguments, Argv } from "yargs";
import { findGitRoot, readConfig } from "@/features/config/config";
import { startHarnessSession } from "@/features/harnesses/api/start-harness-session";
import { parseVars } from "../parse-vars";

export const command = "start";
export const describe = "Create a new session and launch a harness";

export const builder = (yargs: Argv) =>
  yargs
    .option("prompt", { type: "string", describe: "Initial prompt" })
    .option("template", { type: "string", describe: "Prompt template name (mutually exclusive with --prompt)" })
    .option("var", { type: "string", array: true, describe: "Template variable in key=value format" })
    .option("title", { type: "string", describe: "Session title (defaults to prompt excerpt)" })
    .option("workspace-id", { type: "string", describe: "Workspace ID or shorthand" })
    .option("project-id", { type: "string", describe: "Project ID" })
    .option("harness", { type: "string", describe: "Harness provider id" })
    .option("model", { type: "string", describe: "Model override" })
    .option("original-session-id", { type: "string", describe: "ID of the session that triggered this one" })
    .check((argv) => {
      if (!argv.prompt && !argv.template) throw new Error("At least one of --prompt or --template is required.");
      if (argv.prompt && argv.template) throw new Error("--prompt and --template are mutually exclusive");
      return true;
    });

type StartArgs = {
  prompt?: string;
  template?: string;
  var?: string[];
  title?: string;
  "workspace-id"?: string;
  "project-id"?: string;
  harness?: string;
  model?: string;
  "original-session-id"?: string;
};

const resolveProjectId = (argv: Arguments<StartArgs>) => {
  if (argv["project-id"]) return argv["project-id"];

  const root = findGitRoot(process.cwd());
  if (!root) throw new Error("Not inside a pstdio project. Run 'pstdio projects create' first.");
  const config = readConfig(root);
  if (!config) throw new Error("Not inside a pstdio project. Run 'pstdio projects create' first.");
  return config.project_id;
};

export const handler = async (argv: Arguments<StartArgs>) => {
  const projectId = resolveProjectId(argv);
  const title = argv.title ?? (argv.prompt ?? argv.template ?? "").slice(0, 50);
  const session = await startHarnessSession({
    project_id: projectId,
    title,
    prompt: argv.prompt,
    template: argv.template,
    vars: parseVars(argv.var),
    harness: argv.harness,
    workspace_id: argv["workspace-id"],
    model: argv.model,
    original_session_id: argv["original-session-id"],
  });

  const lines = [`Created harness session ${session.id}`];
  if (argv["workspace-id"]) lines.push(`Workspace: ${argv["workspace-id"]}`);
  lines.push(`Harness: ${session.agent ?? argv.harness ?? "default"}`);
  lines.push(`Status:  ${session.status}`);
  console.log(lines.join("\n"));
};
