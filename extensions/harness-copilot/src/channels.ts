import type { PermissionRequest, PermissionRequestResult } from "@github/copilot-sdk";
import type { HarnessApprovalChannel, HarnessQuestionChannel } from "@pstdio/sdk/extensions";

const describe = (request: PermissionRequest) => {
  switch (request.kind) {
    case "shell":
      return { toolName: "shell", toolInput: { command: request.fullCommandText, intention: request.intention } };
    case "write":
      return {
        toolName: "write",
        toolInput: { path: request.fileName, intention: request.intention, diff: request.diff },
      };
    case "read":
      return { toolName: "read", toolInput: { path: request.path, intention: request.intention } };
    case "url":
      return { toolName: "fetch", toolInput: { url: request.url, intention: request.intention } };
    case "mcp":
      return { toolName: `${request.serverName}.${request.toolName}`, toolInput: request.args };
    default:
      return { toolName: request.kind, toolInput: request };
  }
};

/** Route Copilot permission prompts to the host's approval dialog. */
export const permissionHandler =
  (approvals: HarnessApprovalChannel | undefined) =>
  async (request: PermissionRequest): Promise<PermissionRequestResult> => {
    // No channel means nobody can be asked. Saying the person refused would be a lie Copilot acts on.
    if (!approvals) return { kind: "user-not-available" };
    const id = crypto.randomUUID();
    const { decision } = await approvals.requestApproval({
      id,
      ...describe(request),
      toolUseId: request.toolCallId ?? id,
    });
    if (decision === "approve") return { kind: "approve-once" };
    if (decision === "timeout") return { kind: "reject", feedback: "Approval timed out." };
    return { kind: "reject", feedback: "The user doesn't want to proceed with this tool use." };
  };

/** Route Copilot's ask_user tool to the host question form. */
export const userInputHandler =
  (questions: HarnessQuestionChannel, pendingCall: () => string | undefined) =>
  async (request: { question: string; choices?: string[] }) => {
    const id = crypto.randomUUID();
    const response = await questions.ask({
      id,
      toolUseId: pendingCall() ?? id,
      questions: [{ question: request.question, options: request.choices?.map((label) => ({ label })) }],
    });
    const answer = response.answers[0]?.join(", ") ?? "";
    return { answer, wasFreeform: !request.choices?.includes(answer) };
  };
