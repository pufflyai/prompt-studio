import type { ExtensionContextBase } from "@pstdio/sdk/extensions";
import { plannerTicketsChanged } from "../events";
import { ticketsCollection, withDerivedTicketState } from "./collections";
import { ticketKeyPages } from "./ticket-selection";
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
      let cleared = 0;
      for await (const page of ticketKeyPages(ctx.storage, {
        field: "blockedReason",
        op: "contains",
        value: "Complete ",
      })) {
        for (const key of page) {
          let changed = false;
          await collection.change(String(key.fields.id), async (current) => {
            changed = false;
            const next = await withDerivedTicketState(ctx, current);
            if (current.blockedReason === next.blockedReason) return current;
            changed = true;
            return { ...next, updatedAt: new Date().toISOString() };
          });
          if (changed) cleared++;
        }
      }
      if (cleared) await ctx.events.emit(plannerTicketsChanged, {});
      return cleared;
    },
    () => 0,
  );
