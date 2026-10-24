import type { ExtensionContextBase, KanbanRendererMove } from "@pstdio/sdk/extensions";
import { ticketsCollection } from "../data/collections";
import { ticketWithAttributes } from "../data/ticket-attributes";
import { ticketOrderChanges } from "../data/ticket-order";
import { withWriteGuard } from "../data/write-guard";
import { plannerTicketsChanged } from "../events";
import { deadlineOrNone, loadPlan, writeStoredPlan } from "../timeline/commands/plan-store";
import { moveTicket } from "../timeline/model/edit-plan";

export const moveTicketOnBoard = async (
  ctx: Pick<ExtensionContextBase, "storage" | "events" | "projectId" | "extensionId" | "settings" | "resources">,
  input: KanbanRendererMove,
) =>
  withWriteGuard(ctx, "ticket-order", async () => {
    const collection = ticketsCollection(ctx);
    const tickets = await collection.list();
    const existing = tickets.find(({ id }) => id === input.rowId);
    if (!existing) return { changed: 0 };
    const { milestone, ...attributes } = input.attributes;
    const moving = await ticketWithAttributes(ctx.storage, existing, attributes);
    const changes = new Map(
      (input.order ? ticketOrderChanges(tickets, input.rowId, input.order.beforeRowId) : []).map((ticket) => [
        ticket.id,
        ticket,
      ]),
    );
    if (moving !== existing || changes.has(existing.id)) {
      changes.set(existing.id, { ...moving, sortOrder: changes.get(existing.id)?.sortOrder ?? existing.sortOrder });
    }
    const save = async (savePlan?: () => Promise<void>) => {
      const now = new Date().toISOString();
      for (const ticket of changes.values()) await collection.put(ticket.id, { ...ticket, updatedAt: now });
      await savePlan?.();
      if (changes.size || savePlan) await ctx.events.emit(plannerTicketsChanged, { ticketId: input.rowId });
      return { changed: changes.size };
    };
    if (milestone === undefined) return save();
    return withWriteGuard(ctx, "plan", async () => {
      const { plan } = await loadPlan(ctx);
      const deadlineId = typeof milestone === "string" && milestone ? deadlineOrNone(plan, milestone) : null;
      const current = plan.order.find(({ ticketId }) => ticketId === input.rowId)?.deadlineId ?? null;
      if (current === deadlineId) return save();
      const next = moveTicket(plan, { ticketId: input.rowId, deadlineId });
      return save(() => writeStoredPlan(ctx.storage, next));
    });
  });
