import type { Arguments, Argv } from "yargs";
import { API_URL } from "@/features/api-url";
import { findGitRoot, readConfig } from "@/features/config/config";
import { createSession as defaultCreateSession } from "@/features/sessions/api/create-session";
import { parseVars } from "./parse-vars";

export const command = "create";
export const describe = "Create a new session and launch an agent";

export const builder = (yargs: Argv) =>
  yargs
    .option("prompt", { type: "string", describe: "Initial prompt" })
    .option("template", { type: "string", describe: "Prompt template name (mutually exclusive with --prompt)" })
    .option("var", { type: "string", array: true, describe: "Template variable in key=value format" })
    .option("title", { type: "string", describe: "Session title (defaults to prompt excerpt)" })
    .option("workspace-id", { type: "string", describe: "Workspace ID or shorthand" })
    .option("project-id", { type: "string", describe: "Project ID" })
    .option("agent", { type: "string", describe: "Agent to use (claude-code, opencode)" })
    .option("model", { type: "string", describe: "Model override" })
    .option("original-session-id", { type: "string", describe: "ID of the session that triggered this one" })
    .check((argv) => {
      if (!argv.prompt && !argv.template) throw new Error("At least one of --prompt or --template is required.");
      if (argv.prompt && argv.template) throw new Error("--prompt and --template are mutually exclusive");
      return true;
    });

export type CreateArgs = {
  prompt?: string;
  template?: string;
  var?: string[];
  title?: string;
  "workspace-id"?: string;
  "project-id"?: string;
  agent?: string;
  model?: string;
  "original-session-id"?: string;
};

type Deps = {
  cwd: () => string;
  findGitRoot: typeof findGitRoot;
  readConfig: typeof readConfig;
  createSession: typeof defaultCreateSession;
  log: (msg: string) => void;
};

const defaultDeps: Deps = {
  cwd: () => process.cwd(),
  findGitRoot,
  readConfig,
  createSession: defaultCreateSession,
  log: console.log,
};

export const createHandler =
  (deps: Deps = defaultDeps) =>
  async (argv: Arguments<CreateArgs>) => {
    let projectId = argv["project-id"];

    if (!projectId) {
      const root = deps.findGitRoot(deps.cwd());
      if (!root) throw new Error("Not inside a pstdio project. Run 'pstdio projects create' first.");
      const config = deps.readConfig(root);
      if (!config) throw new Error("Not inside a pstdio project. Run 'pstdio projects create' first.");
      projectId = config.project_id;
    }

    const title = argv.title ?? (argv.prompt ?? argv.template ?? "").slice(0, 50);
    const agent = argv.agent;

    const session = await deps.createSession(API_URL, {
      project_id: projectId,
      title,
      prompt: argv.prompt,
      template: argv.template,
      vars: parseVars(argv.var),
      agent,
      workspace_id: argv["workspace-id"],
      model: argv.model,
      original_session_id: argv["original-session-id"],
    });

    const lines = [`Created session ${session.id}`];

    if (argv["workspace-id"]) {
      lines.push(`Workspace: ${argv["workspace-id"]}`);
    }

    lines.push(`Agent:     ${session.agent ?? agent}`);
    lines.push(`Status:    ${session.status}`);

    deps.log(lines.join("\n"));
  };

export const handler = createHandler();
