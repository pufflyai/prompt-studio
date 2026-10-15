import { defineCommand, params } from "@pstdio/sdk/extensions";
import { readAutoBuildMode } from "../data/auto-build-mode";
import { readAutoBuildSupervisor, saveAutoBuildSupervisor } from "../data/auto-build-supervisor";
import { withWriteGuard } from "../data/write-guard";
import type { NextTicketQuery } from "./next-ticket-query";
import { readNextTickets } from "./next-tickets";

export const autoBuildScopeCommand = defineCommand({
  id: "auto-build.scope",
  title: "Set the Auto Build work scope",
  cli: { description: "Share the supervisor's work queries with wake checks and dispatch." },
  mutating: true,
  params: {
    revision: params.text({ required: true }),
    queries: params.json<NextTicketQuery[]>(),
  },
  async run(ctx, { revision, queries }) {
    return withWriteGuard(ctx, "auto-build-supervisor", async () => {
      const mode = await readAutoBuildMode(ctx);
      if (!mode.enabled || mode.revision !== revision) throw new Error("Auto Build stopped. Read its mode again.");
      if (!Array.isArray(queries) || !queries.length) throw new Error("Provide at least one work query.");
      const work = await readNextTickets(ctx, mode, {}, queries);
      const current = await readAutoBuildMode(ctx);
      if (!current.enabled || current.revision !== revision)
        throw new Error("Auto Build stopped. Read its mode again.");
      const supervisor = await readAutoBuildSupervisor(ctx);
      await saveAutoBuildSupervisor(ctx, {
        ...supervisor,
        scope: { revision, queries },
        lastWake: work.snapshot,
      });
      return {
        enabled: true,
        revision,
        queries,
        tickets: work.tickets,
        waiting: work.waiting,
        capacity: work.capacity,
      };
    });
  },
});
