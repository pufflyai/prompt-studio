import type { ExtensionContextBase } from "@pstdio/sdk/extensions";
import { plannerTicketsChanged } from "../events";
import { ticketsCollection } from "./collections";
import { dependencyBlockerIds, dependencyTicketIndex } from "./dependency-blockers";
import { readWorkflowStatuses, usableWorkflowStatuses } from "./workflow-statuses";
import { withWriteGuard } from "./write-guard";

export const reconcileDependencyBlockers = async (
  ctx: Pick<ExtensionContextBase, "storage" | "events" | "projectId" | "extensionId" | "settings" | "resources">,
) =>
  withWriteGuard(
    ctx,
    "dependency-blockers",
    async () => {
      const collection = ticketsCollection(ctx);
      const [tickets, workflow] = await Promise.all([collection.list(), readWorkflowStatuses(ctx)]);
      const doneIds = new Set(usableWorkflowStatuses(workflow).completedStatusIds);
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
