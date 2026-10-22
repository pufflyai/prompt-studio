import type { CommandContext } from "@pstdio/sdk/extensions";
import type { AttemptRecord, TicketAttemptSelection } from "../data/attempt-types";
import { WorkspaceUnavailableError } from "./change-requests";
import { readStackRepair } from "./update-stack";

export async function readSelectedStackRepair(
  ctx: CommandContext,
  ticketId: string,
  attempts: AttemptRecord[],
  selections: TicketAttemptSelection[],
  retired: Set<string>,
  policy: { requireMergedDependencies: boolean },
) {
  const existing = attempts.filter((attempt) => attempt.ticketId === ticketId && !retired.has(attempt.workspaceId));
  const selection = selections.find((selection) => selection.ticketId === ticketId);
  let chosen: AttemptRecord | undefined;
  if (selection) chosen = existing.find(({ workspaceId }) => workspaceId === selection.workspaceId);
  else if (existing.length === 1) chosen = existing[0];
  if (!chosen) return null;
  try {
    return await readStackRepair(ctx, chosen, policy);
  } catch (error) {
    if (!(error instanceof WorkspaceUnavailableError)) throw error;
    return { unavailableWorkspaceId: chosen.workspaceId, detail: error.message, attempt: chosen };
  }
}

export const canOfferStackRepair = (
  reason: string | undefined,
  resumable: boolean,
  capacity: { running: number; limit: number },
) => capacity.running < capacity.limit && (reason === "existing-attempt" || (!reason && resumable));
