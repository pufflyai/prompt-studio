import type { SessionAttachmentRef } from "@pstdio/sdk/api";
import type { Arguments, Argv } from "yargs";
import { apiClient } from "@/features/api-client";
import { followUpSession as defaultFollowUp } from "@/features/sessions/api/follow-up-session";
import { deleteCliSessionAttachments, uploadCliSessionAttachments } from "./session-attachments";

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
    .option("model", { type: "string", describe: "Model override" })
    .option("attach", { type: "string", array: true, describe: "Local file to attach to the follow-up prompt" });

export type FollowUpArgs = {
  id: string;
  prompt?: string;
  "summary-of"?: string;
  "summary-format"?: "brief" | "detailed";
  "summary-role"?: "assistant" | "all";
  agent?: string;
  model?: string;
  attach?: string[];
};

type Deps = {
  followUpSession: typeof defaultFollowUp;
  getSession: (sessionId: string) => Promise<{ project_id: string | null }>;
  uploadAttachments: typeof uploadCliSessionAttachments;
  deleteAttachments: typeof deleteCliSessionAttachments;
  cwd: () => string;
  log: (msg: string) => void;
};

const defaultDeps: Deps = {
  followUpSession: defaultFollowUp,
  getSession: (sessionId) => apiClient().sessions.get(sessionId),
  uploadAttachments: uploadCliSessionAttachments,
  deleteAttachments: deleteCliSessionAttachments,
  cwd: () => process.cwd(),
  log: console.log,
};

type FollowUpApiInput = {
  prompt?: string;
  agent?: string;
  model?: string;
  summary_from_session_id?: string;
  summary_format?: "brief" | "detailed";
  summary_role?: "assistant" | "all";
  attachments?: SessionAttachmentRef[];
};

const buildFollowUpInput = (argv: Arguments<FollowUpArgs>) => {
  if (!argv.prompt && !argv["summary-of"]) {
    throw new Error("At least one of --prompt or --summary-of is required.");
  }

  const input: FollowUpApiInput = {};
  if (argv.prompt) input.prompt = argv.prompt;
  if (argv.agent) input.agent = argv.agent;
  if (argv.model) input.model = argv.model;
  if (argv["summary-of"]) input.summary_from_session_id = argv["summary-of"];
  if (argv["summary-format"]) input.summary_format = argv["summary-format"];
  if (argv["summary-role"]) input.summary_role = argv["summary-role"];
  return input;
};

const followUpOutput = (result: Awaited<ReturnType<typeof defaultFollowUp>>) => {
  const lines = [`Follow-up sent to session ${result.id}`];
  lines.push(`Agent:  ${result.agent ?? "unknown"}`);
  lines.push(`Status: ${result.status}`);
  if (result.follow_up) {
    const decisionLine =
      result.follow_up.status === "queued"
        ? `Follow-up: queued (position ${result.follow_up.queue_position})`
        : "Follow-up: dispatched";
    lines.push(decisionLine);
  }
  return lines.join("\n");
};

export const createHandler =
  (deps: Deps = defaultDeps) =>
  async (argv: Arguments<FollowUpArgs>) => {
    const input = buildFollowUpInput(argv);
    const attachmentPaths = argv.attach ?? [];
    let cleanupProjectId: string | undefined;

    if (attachmentPaths.length > 0) {
      const session = await deps.getSession(argv.id);
      if (!session.project_id) throw new Error("Cannot attach files to a session without a project.");
      cleanupProjectId = session.project_id;
      input.attachments = await deps.uploadAttachments({
        projectId: cleanupProjectId,
        paths: attachmentPaths,
        cwd: deps.cwd(),
      });
    }

    try {
      const result = await deps.followUpSession(argv.id, input);
      deps.log(followUpOutput(result));
    } catch (error) {
      if (cleanupProjectId) {
        await deps.deleteAttachments({ projectId: cleanupProjectId, attachments: input.attachments });
      }
      throw error;
    }
  };

export const handler = createHandler();
