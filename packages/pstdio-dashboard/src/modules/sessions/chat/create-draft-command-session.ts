import type { CreateSessionResponse, DraftHarnessCommandInput, HarnessOperation } from "pstdio-api-contracts";
import { apiRequest } from "@/lib/api";

export const createDraftCommandSession = async (
  draft: DraftHarnessCommandInput | undefined,
  operation: HarnessOperation,
) => {
  if (!draft?.agent) throw new Error("Select a project and an agent before sending.");
  const session = await apiRequest<CreateSessionResponse>("/v1/sessions", {
    method: "POST",
    body: { ...draft, operation, title: operation.kind === "command" ? operation.text.slice(0, 100) : "New session" },
  });
  let status = session.operation_result?.status ?? "completed";
  if (session.status === "failed" || session.status === "disconnected") status = "started";
  return {
    sessionId: session.id,
    status,
    message: session.operation_result?.message,
  };
};
