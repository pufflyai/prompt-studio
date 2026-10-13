import { defineCommand, params } from "@pstdio/sdk/extensions";
import { readAutoBuildMode, saveAutoBuildMode } from "../data/auto-build-mode";
import { ticketsCollection } from "../data/collections";
import { withWriteGuard } from "../data/write-guard";

export const resolveAutoBuildScopeCommand = defineCommand({
  id: "auto-build.scope",
  title: "Resolve Auto Build ticket scope",
  cli: true,
  mutating: true,
  params: {
    revision: params.text({ required: true }),
    ticketIds: params.json<string[], { required: true }>({ required: true }),
  },
  async run(ctx, { revision, ticketIds }) {
    return withWriteGuard(ctx, "workflow-config", async () => {
      const mode = await readAutoBuildMode(ctx);
      if (!mode.enabled || mode.revision !== revision) throw new Error("Auto Build scope changed or the run stopped.");
      if (mode.scopeTicketIds !== null)
        throw new Error("Scope is already resolved. Edit the run configuration to change it.");
      const tickets = await ticketsCollection(ctx.storage).list();
      if (
        !Array.isArray(ticketIds) ||
        ticketIds.some((id) => !tickets.some((ticket) => ticket.id === id && !ticket.archived && !ticket.draft))
      )
        throw new Error("Choose current tickets for the requested scope.");
      return saveAutoBuildMode(ctx, {
        ...mode,
        scopeTicketIds: [...new Set(ticketIds)],
        revision: crypto.randomUUID(),
      });
    });
  },
});
