import type { Arguments, Argv } from "yargs";
import { API_URL } from "@/features/api-url";
import { getSession as defaultGetSession } from "@/features/sessions/api/get-session";

export const command = "approve";
export const describe = "Approve a pending agent tool permission request";

export const builder = (yargs: Argv) =>
  yargs
    .option("id", { type: "string", demandOption: true, describe: "Session ID" })
    .option("approval-id", { type: "string", demandOption: true, describe: "Approval request ID" });

type ApproveArgs = { id: string; "approval-id": string };

type Deps = {
  getSession: typeof defaultGetSession;
  sendApproval: (baseUrl: string, sessionId: string, approvalId: string, decision: string) => Promise<void>;
  log: (msg: string) => void;
};

const defaultSendApproval = async (baseUrl: string, sessionId: string, approvalId: string, decision: string) => {
  const res = await fetch(`${baseUrl}/v1/sessions/${sessionId}/approve`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ id: approvalId, decision }),
  });
  if (!res.ok) throw new Error(`Failed to send approval: ${res.status}`);
};

const defaultDeps: Deps = {
  getSession: defaultGetSession,
  sendApproval: defaultSendApproval,
  log: console.log,
};

export const createHandler =
  (deps: Deps = defaultDeps) =>
  async (argv: Arguments<ApproveArgs>) => {
    const session = await deps.getSession(argv.id);
    if (!session) throw new Error(`Session not found: ${argv.id}`);

    if (session.status !== "awaiting_input") {
      throw new Error("Session is not awaiting input");
    }

    await deps.sendApproval(API_URL, argv.id, argv["approval-id"], "approve");
    deps.log(`Approved tool request for session ${argv.id}.\nSession ${argv.id} resumed.`);
  };

export const handler = createHandler();
