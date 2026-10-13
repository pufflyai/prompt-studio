import type { CommandContext } from "@pstdio/sdk/extensions";
import type { AttemptRecord, TicketAttemptSelection } from "../data/attempt-types";
import { readStackRepair } from "./update-stack";

export async function readSelectedStackRepair(
  ctx: CommandContext,
  ticketId: string,
  attempts: AttemptRecord[],
  selections: TicketAttemptSelection[],
) {
  const existing = attempts.filter((attempt) => attempt.ticketId === ticketId && attempt.state !== "abandoned");
  const selection = selections.find((selection) => selection.ticketId === ticketId);
  if (selection) {
    const chosen = existing.find(({ workspaceId }) => workspaceId === selection.workspaceId);
    return chosen ? readStackRepair(ctx, chosen) : null;
  }
  if (existing.length === 1) return readStackRepair(ctx, existing[0]!);
  return null;
}

export const canOfferStackRepair = (
  reason: string | undefined,
  resumable: boolean,
  capacity: { running: number; limit: number },
) => capacity.running < capacity.limit && (reason === "existing-attempt" || (!reason && resumable));
