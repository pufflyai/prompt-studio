import { defineCommand, type ExtensionStorageApi } from "@pstdio/sdk/extensions";
import { ticketsCollection } from "../data/collections";
import { sortedBySortOrder } from "../utils/sort";
export const readTickets = async (storage: ExtensionStorageApi) =>
  sortedBySortOrder((await ticketsCollection(storage).list()).filter((ticket) => !ticket.archived));

export const readTicketsCommand = defineCommand({
  id: "read-tickets",
  title: "Read tickets",
  async run(ctx, _commandParams) {
    return readTickets(ctx.storage);
  },
});
