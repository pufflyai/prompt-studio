import type { ExtensionContextBase } from "@pstdio/sdk/extensions";
import { plannerTicketsChanged } from "../events";
import { ticketsCollection } from "./collections";
import { dependencyBlockerIds, dependencyTicketIndex } from "./dependency-blockers";
import { withWriteGuard } from "./write-guard";

// Dependency waiting lives in links. Reads and saves already drop a dependency-only sentence that
// names linked prerequisites, whatever their status, so stored copies are removed by the same rule.
export const reconcileDependencyBlockers = async (
  ctx: Pick<ExtensionContextBase, "storage" | "events" | "projectId" | "extensionId" | "settings" | "resources">,
) =>
  withWriteGuard(
    ctx,
    "dependency-blockers",
    async () => {
      const collection = ticketsCollection(ctx);
      const tickets = await collection.list();
      const byRef = dependencyTicketIndex(tickets);
      const cleared: string[] = [];
      for (const listed of tickets) {
        if (!dependencyBlockerIds(listed, byRef)) continue;
        // Re-read the ticket so an independent blocker saved after the list is kept.
        const current = await collection.get(listed.id);
        if (!current || !dependencyBlockerIds(current, byRef)) continue;
        await collection.update(current.id, { ...current, blockedReason: null, updatedAt: new Date().toISOString() });
        cleared.push(current.id);
      }
      if (cleared.length) await ctx.events.emit(plannerTicketsChanged, {});
      return cleared;
    },
    () => [],
  );
