import { getTicket as defaultGetTicket } from "./api/get-ticket";
import { resolveTicketByShorthand as defaultResolveTicketByShorthand } from "./resolve-ticket-by-shorthand";

const TICKET_SHORTHAND_PATTERN = /^[A-Z]+-\d+$/;

type Deps = {
  resolveTicketByShorthand: typeof defaultResolveTicketByShorthand;
  getTicket: typeof defaultGetTicket;
};

const defaultDeps: Deps = {
  resolveTicketByShorthand: defaultResolveTicketByShorthand,
  getTicket: defaultGetTicket,
};

export const createResolveParentTicketId =
  (deps: Deps = defaultDeps) =>
  async (projectId: string, value: string) => {
    if (TICKET_SHORTHAND_PATTERN.test(value)) {
      const ticket = await deps.resolveTicketByShorthand(projectId, value);
      if (ticket) return ticket.id;
      throw new Error(`Parent ticket not found: ${value}`);
    }

    const ticket = await deps.getTicket(value);
    if (ticket) return ticket.id;

    throw new Error(`Parent ticket not found: ${value}`);
  };

export const resolveParentTicketId = createResolveParentTicketId();
