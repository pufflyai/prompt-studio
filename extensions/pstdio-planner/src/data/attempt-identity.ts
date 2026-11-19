import type { AttemptRecord, TicketAttemptSelection } from "./attempt-types";

// Older Git attempts used their isolated workspace as their identity. A shared
// project workspace can execute many attempts, each with its own extension-owned ID.
export const attemptId = (attempt: Pick<AttemptRecord, "id" | "workspaceId">) => attempt.id ?? attempt.workspaceId;
export const selectedAttemptId = (selection: TicketAttemptSelection) => selection.attemptId ?? selection.workspaceId;

export const resolveAttemptId = (input: { attemptId?: string; workspaceId?: string }) => {
  if (input.attemptId && input.workspaceId) throw new Error("Choose an attempt ID or a legacy workspace ID.");
  const id = input.attemptId ?? input.workspaceId;
  if (!id) throw new Error("An attempt ID is required.");
  return id;
};
