import type { PluginHelperContext, TicketRef } from "./context";
import { findTicketByRef } from "./find-ticket-by-ref";

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

  const result = await ctx.client.tickets.updateWhenAttemptStatus(ticketId, {
    all_attempts_status: input.allAttemptsStatus,
    set_status: input.setStatus,
  });

  return result.updated;
};
