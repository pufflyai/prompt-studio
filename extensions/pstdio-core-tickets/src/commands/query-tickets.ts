import { defineCommand } from "@pstdio/sdk/extensions";
import { runTicketsQuery } from "../data/query";

// Backs the tickets data-renderer. The host invokes this per query and re-applies
// filter / sort / group locally, so we return the full visible set.
export const queryTicketsCommand = defineCommand({
  title: "Query tickets",
  async run(ctx) {
    return runTicketsQuery({ storage: ctx.storage, projectId: ctx.projectId });
  },
});
