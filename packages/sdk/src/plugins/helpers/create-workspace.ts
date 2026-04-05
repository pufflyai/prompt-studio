import type { CreateTicketAttemptInput } from "../../api/tickets";
import type { PluginHelperContext, TicketRef } from "./context";
import { findTicketByRef } from "./find-ticket-by-ref";

type CreateWorkspaceHelperInput = TicketRef &
  Omit<CreateTicketAttemptInput, "agent" | "model" | "prompt" | "start_session">;

export const createWorkspace = async (ctx: PluginHelperContext, input: CreateWorkspaceHelperInput) => {
  const ticketId = (await findTicketByRef(ctx, input))?.id;
  if (!ticketId) return null;

  const { ticketId: _ticketId, ...attemptInput } = input;
  return ctx.client.tickets.createAttempt(ticketId, {
    ...attemptInput,
    start_session: false,
  });
};
