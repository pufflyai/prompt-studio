import type { Arguments, Argv } from "yargs";
import { findGitRoot, readConfig } from "@/features/config/config";
import { createSession as defaultCreateSession } from "@/features/sessions/api/create-session";
import { deleteCliSessionAttachments, uploadCliSessionAttachments } from "./session-attachments";

export const command = "create";
export const describe = "Create a new session and launch an agent";

export const builder = (yargs: Argv) =>
  yargs
    .option("prompt", { type: "string", describe: "Initial prompt" })
    .option("title", { type: "string", describe: "Session title (defaults to prompt excerpt)" })
    .option("workspace-id", { type: "string", describe: "Workspace ID or shorthand" })
    .option("project-id", { type: "string", describe: "Project ID" })
    .option("agent", { type: "string", describe: "Agent to use (claude-code, opencode)" })
    .option("model", { type: "string", describe: "Model override" })
    .option("attach", { type: "string", array: true, describe: "Local file to attach to the session prompt" })
    .option("original-session-id", { type: "string", describe: "ID of the session that triggered this one" })
    .check((argv) => {
      if (!argv.prompt) throw new Error("--prompt is required.");
      return true;
    });

export type CreateArgs = {
  prompt?: string;
  title?: string;
  "workspace-id"?: string;
  "project-id"?: string;
  agent?: string;
  model?: string;
  attach?: string[];
  "original-session-id"?: string;
};

type Deps = {
  cwd: () => string;
  findGitRoot: typeof findGitRoot;
  readConfig: typeof readConfig;
  createSession: typeof defaultCreateSession;
  uploadAttachments: typeof uploadCliSessionAttachments;
  deleteAttachments: typeof deleteCliSessionAttachments;
  log: (msg: string) => void;
};

const defaultDeps: Deps = {
  cwd: () => process.cwd(),
  findGitRoot,
  readConfig,
  createSession: defaultCreateSession,
  uploadAttachments: uploadCliSessionAttachments,
  deleteAttachments: deleteCliSessionAttachments,
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

    const title = argv.title ?? (argv.prompt ?? "").slice(0, 50);
    const agent = argv.agent;
    const attachments = argv.attach?.length
      ? await deps.uploadAttachments({
          projectId,
          paths: argv.attach,
          cwd: deps.cwd(),
        })
      : undefined;

    try {
      const session = await deps.createSession({
        project_id: projectId,
        title,
        prompt: argv.prompt,
        agent,
        attachments,
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
    } catch (error) {
      await deps.deleteAttachments({ projectId, attachments });
      throw error;
    }
  };

export const handler = createHandler();
