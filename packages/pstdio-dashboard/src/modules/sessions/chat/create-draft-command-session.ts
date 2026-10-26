import type { DraftHarnessCommandInput, HarnessOperation } from "pstdio-api-contracts";
import { getApiClient } from "@/lib/api";
import { isFolderMissingError } from "@/shared/projects/folder-missing-error";

export const createDraftCommandSession = async (
  draft: DraftHarnessCommandInput | undefined,
  operation: HarnessOperation,
  // Runs when the harness works on files and the project's folder is not on this device yet.
  onFolderMissing: () => void,
) => {
  if (!draft?.agent) throw new Error("Select a project and an agent before sending.");
  const session = await getApiClient()
    .sessions.create({
      ...draft,
      operation,
      title: operation.kind === "command" ? operation.text.slice(0, 100) : "New session",
    })
    .catch((error: unknown) => {
      if (isFolderMissingError(error)) onFolderMissing();
      throw error;
    });
  let status = session.operation_result?.status ?? "completed";
  if (session.status === "failed" || session.status === "disconnected") status = "started";
  return {
    sessionId: session.id,
    status,
    message: session.operation_result?.message,
  };
};
