import type { PluginHelperContext, TicketRef } from "./context";
import { findTicketByRef } from "./find-ticket-by-ref";
import { executePlannerCommand } from "./planner";

type TicketAttemptStatusTransitionInput = TicketRef & {
  allAttemptsStatus: string;
  setStatus: string;
};

export const updateTicketWhenAllAttemptsMatch = async (
  ctx: PluginHelperContext,
  input: TicketAttemptStatusTransitionInput,
) => {
  const ticket = await findTicketByRef(ctx, input);
  const ticketId = ticket?.id;
  if (!ticketId) return false;

  const result = (await executePlannerCommand(ctx, "pstdio.planner.updateTicketWhenAttemptStatus", {
    ticket_id: ticketId,
    all_attempts_status: input.allAttemptsStatus,
    set_status: input.setStatus,
  })) as { updated: boolean };

  return result.updated;
};
