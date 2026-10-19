import type { ExtensionStorageApi } from "@pstdio/sdk/extensions";
import { createMemoryStorage } from "@pstdio/sdk/testing";
import { ticketsCollection } from "../data/collections";
import { makeCommandContext } from "./command-context.fixture";
import { createTicketCommand } from "./create-ticket";

export const ticketMoveFixture = async () => {
  const storage = createMemoryStorage();
  const ctx = makeCommandContext({ storage, params: {} });
  const tickets = [];
  for (const title of ["First", "Hidden", "Last"]) tickets.push(await createTicketCommand.run(ctx, { title }));
  const stored = await ticketsCollection(storage).list();
  const writes: string[] = [];
  const events: string[] = [];
  const observed: ExtensionStorageApi = {
    ...storage,
    collection<T>(name: string) {
      const collection = storage.collection<T>(name);
      return {
        ...collection,
        async put(id: string, value: T) {
          if (name === "tickets") writes.push(id);
          await collection.put(id, value);
        },
      };
    },
  };
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
  const ordered = async () =>
    (await ticketsCollection(storage).list()).sort((a, b) => a.sortOrder - b.sortOrder).map(({ id }) => id);
  return {
    storage,
    ctx: movingContext,
    tickets: tickets.map((ticket) => stored.find(({ id }) => id === ticket.id)!),
    writes,
    events,
    ordered,
  };
};
