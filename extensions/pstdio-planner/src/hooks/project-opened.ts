import { defineHook, projectEvents } from "@pstdio/sdk/extensions";
import { migrateTicketIdentities } from "../data/migrate-ticket-identities";
import { plannerTicketsChanged } from "../events";

export const projectOpenedHook = defineHook({
  id: "migrate-ticket-identities",
  event: projectEvents.opened,
  async run(ctx) {
    const result = await migrateTicketIdentities(ctx);
    if (result.migrated > 0) await ctx.events.emit(plannerTicketsChanged, {});
  },
});
