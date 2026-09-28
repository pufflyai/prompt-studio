import { defineHook, projectEvents } from "@pstdio/sdk/extensions";
import { plannerTicketsChanged } from "../../events";
import { migrateTicketIdentities } from "./migrate";

export const projectOpenedHook = defineHook({
  id: "migrate-ticket-identities",
  event: projectEvents.opened,
  async run(ctx) {
    const result = await migrateTicketIdentities(ctx);
    if (result.migrated > 0) await ctx.events.emit(plannerTicketsChanged, {});
  },
});
