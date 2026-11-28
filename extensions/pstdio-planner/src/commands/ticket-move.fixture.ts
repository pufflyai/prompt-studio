import { createMemoryStorage } from "@pstdio/sdk/testing";
import { observeTicketRecords } from "../data/storage-reads.fixture";
import { ticketsCollection } from "../data/ticket-context.fixture";
import { sortedByTicketOrder } from "../utils/sort";

import { makeCommandContext } from "./command-context.fixture";
import { createTicketCommand } from "./create-ticket";

export const ticketMoveFixture = async () => {
  const storage = createMemoryStorage();
  const ctx = makeCommandContext({ storage, params: {} });
  const tickets = [];
  for (const title of ["First", "Hidden", "Last"]) tickets.push(await createTicketCommand.run(ctx, { title }));
  const stored = await ticketsCollection(storage).list();
  const events: string[] = [];
  const { storage: observed, reads, writes } = observeTicketRecords(storage);
  const movingContext = {
    ...ctx,
    storage: observed,
    events: {
      emit: async (ref: string | { id: string }) => {
        events.push(typeof ref === "string" ? ref : ref.id);
        return { delivered: 0 };
      },
    },
  };
  const ordered = async () => sortedByTicketOrder(await ticketsCollection(storage).list()).map(({ id }) => id);
  return {
    storage,
    ctx: movingContext,
    tickets: tickets.map((ticket) => stored.find(({ id }) => id === ticket.id)!),
    reads,
    writes,
    events,
    ordered,
  };
};
