import type { CreateTicketAttemptInput } from "../../api/tickets";
import type { PluginHelperContext, TicketRef } from "./context";
import { findTicketByRef } from "./find-ticket-by-ref";

type CreateAttemptHelperInput = TicketRef & Omit<CreateTicketAttemptInput, "start_session">;

export const createAttempt = async (ctx: PluginHelperContext, input: CreateAttemptHelperInput) => {
  const ticketId = (await findTicketByRef(ctx, input))?.id;
  if (!ticketId) return null;

  const { ticketId: _ticketId, ...attemptInput } = input;
  return ctx.client.tickets.createAttempt(ticketId, {
    ...attemptInput,
    start_session: true,
  });
};
