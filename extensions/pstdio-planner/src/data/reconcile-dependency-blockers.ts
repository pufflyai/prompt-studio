import type { ExtensionContextBase } from "@pstdio/sdk/extensions";
import { plannerTicketsChanged } from "../events";
import { statusesCollection, ticketsCollection } from "./collections";
import { dependencyBlockerIds, dependencyTicketIndex } from "./dependency-blockers";
import { withWriteGuard } from "./write-guard";

export const reconcileDependencyBlockers = async (
  ctx: Pick<ExtensionContextBase, "storage" | "events" | "projectId" | "extensionId">,
) =>
  withWriteGuard(
    ctx,
    "dependency-blockers",
    async () => {
      const collection = ticketsCollection(ctx.storage);
      const [tickets, statuses] = await Promise.all([collection.list(), statusesCollection(ctx.storage).list()]);
      const doneIds = new Set(statuses.filter(({ name }) => name.trim().toLowerCase() === "done").map(({ id }) => id));
      const byRef = dependencyTicketIndex(tickets);
      const cleared: string[] = [];
      for (const listed of tickets) {
        if (!dependencyBlockerIds(listed, byRef)) continue;
        // Re-read the blocker and its prerequisites so a later independent blocker is kept.
        const current = await collection.get(listed.id);
        if (!current) continue;
        const ids = dependencyBlockerIds(current, byRef);
        if (!ids) continue;
        const dependencies = await Promise.all(ids.map((id) => collection.get(id)));
        if (!dependencies.every((ticket) => ticket && doneIds.has(ticket.statusId ?? ""))) continue;
        await collection.update(current.id, { ...current, blockedReason: null, updatedAt: new Date().toISOString() });
        cleared.push(current.id);
      }
      if (cleared.length) await ctx.events.emit(plannerTicketsChanged, {});
      return cleared;
    },
    () => [],
  );
