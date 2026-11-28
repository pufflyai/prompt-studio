import type { ExtensionContextBase, KanbanRendererMove } from "@pstdio/sdk/extensions";
import { ticketsCollection } from "../data/collections";
import { readTicketOrderChange } from "../data/indexed-ticket-order";
import { ensureTicketStorage } from "../data/read-migrated-tickets";
import { ticketWithAttributes } from "../data/ticket-attributes";
import type { Ticket } from "../data/types";
import { readWorkflowStatuses, usableWorkflowStatuses } from "../data/workflow-statuses";
import { withQueuedWriteGuard, withWriteGuard } from "../data/write-guard";
import { emitPlannerTicketsChanged } from "../events";
import { initializePlanPlacements } from "../timeline/commands/initialize-placements";
import { movePlanPlacement, planPlacements, readPlanMetadata } from "../timeline/commands/placement-store";
import { deadlineOrNone } from "../timeline/commands/plan-store";

export const moveTicketOnBoard = async (
  ctx: Pick<
    ExtensionContextBase,
    "storage" | "events" | "projectId" | "extensionId" | "settings" | "resources" | "commands" | "extensionId" | "files"
  >,
  input: KanbanRendererMove,
) =>
  withQueuedWriteGuard(ctx, "ticket-order", async () => {
    const collection = ticketsCollection(ctx);
    await ensureTicketStorage(ctx);
    const existing = await collection.get(input.rowId);
    if (!existing) return { changed: 0 };
    const { milestone, ...attributes } = input.attributes;
    const moving = await ticketWithAttributes(ctx.storage, existing, attributes);
    const changes = new Map<string, Ticket>(
      (input.order ? await readTicketOrderChange(ctx, input.rowId, input.order.beforeRowId) : []).map((ticket) => [
        ticket.id,
        ticket,
      ]),
    );
    const position = changes.get(existing.id)?.position;
    if (moving !== existing || changes.has(existing.id)) {
      changes.set(existing.id, { ...moving, position: changes.get(existing.id)?.position ?? existing.position });
    }
    const save = async (savePlan?: () => Promise<void>) => {
      const now = new Date().toISOString();
      for (const ticket of changes.values())
        await collection.change(ticket.id, async (current) => ({
          ...(await ticketWithAttributes(ctx.storage, current, attributes)),
          position: position ?? current.position,
          updatedAt: now,
        }));
      await savePlan?.();
      if (changes.size || savePlan) await emitPlannerTicketsChanged(ctx, { ticketId: input.rowId });
      return { changed: changes.size };
    };
    if (milestone === undefined) return save();
    return withWriteGuard(ctx, "plan", async () => {
      const plan = await readPlanMetadata(ctx.storage);
      const deadlineId = typeof milestone === "string" && milestone ? deadlineOrNone(plan, milestone) : null;
      const current = (await planPlacements(ctx.storage).get(input.rowId))?.deadlineId ?? null;
      if (current === deadlineId) return save();
      const workflow = usableWorkflowStatuses(await readWorkflowStatuses(ctx));
      await initializePlanPlacements(ctx, workflow.completedStatusIds);
      return save(async () => {
        await movePlanPlacement(ctx.storage, { ticketId: input.rowId, deadlineId });
      });
    });
  });
