import { defineCommand, type ExtensionStorageApi, params } from "@pstdio/sdk/extensions";
import { ticketsCollection } from "../data/collections";
import { findTicket, resolveStatusId } from "../data/resolve";

// Best-effort: move the ticket into the in-progress column if the project has one,
// mirroring the legacy CLI's "move to wip" step without assuming a fixed name.
const moveToInProgress = async (storage: ExtensionStorageApi, ticketId: string) => {
  for (const name of ["In Progress", "wip"]) {
    try {
      const statusId = await resolveStatusId(storage, name);
      const collection = ticketsCollection(storage);
      const ticket = await collection.get(ticketId);
      if (ticket) await collection.put(ticketId, { ...ticket, statusId, updatedAt: new Date().toISOString() });
      return;
    } catch {
      // Try the next candidate name; absence of an in-progress column is fine.
    }
  }
};

// `pst tickets implement`: move the ticket to in-progress in extension storage and
// launch the implementation agent through the host session capability.
export const implementTicketCommand = defineCommand({
  title: "Implement ticket",
  cli: { globalAliases: [["tickets", "implement"]], examples: ["pstdio tickets implement --id T-1"] },
  params: {
    id: params.text({ required: true }),
    agent: params.harness({ label: "Agent" }),
  },
  async run(ctx) {
    const ticket = await findTicket(ctx.storage, ctx.params.id);
    if (!ticket) throw new Error(`Unknown ticket "${ctx.params.id}"`);

    await moveToInProgress(ctx.storage, ticket.id);

    return ctx.sessions.create({
      title: `Implement ticket: ${ticket.shorthand}`,
      ...(ctx.params.agent ? { harness: ctx.params.agent } : {}),
      template: "implement-ticket",
      vars: { ticket: ticket.id },
    });
  },
});
