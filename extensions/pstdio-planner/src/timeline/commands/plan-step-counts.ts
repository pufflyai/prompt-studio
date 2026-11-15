import type { CommandContext, StorageComputedField, StoragePredicate } from "@pstdio/sdk/extensions";
import type { readTicketViewPage } from "../../data/query-ticket-page";
import { activeTicket } from "../../data/ticket-view-state";

/** Count global predecessors in groups of 16 metrics, without a request per displayed ticket. */
export const planStepCounts = async (
  ctx: CommandContext,
  view: Awaited<ReturnType<typeof readTicketViewPage>>,
  executionOffset?: number,
) => {
  if (executionOffset !== undefined) return view.tickets.map((_, i) => executionOffset + i + 1);
  const result: number[] = [];
  for (let start = 0; start < view.tickets.length; start += 16) {
    const page = view.tickets.slice(start, start + 16);
    const computed: Record<string, StorageComputedField> = {};
    const metrics: Record<string, { operation: "sum"; field: string }> = {};
    for (const [i, ticket] of page.entries()) {
      const fields = view.projections.get(ticket.id)!;
      const deadlineId = typeof fields.deadlineId === "string" ? fields.deadlineId : null;
      let rank = view.metadata.deadlines.findIndex(({ id }) => id === deadlineId);
      if (rank < 0) rank = view.metadata.deadlines.length;
      const before: StoragePredicate = {
        any: [
          { field: "deadlineId", op: "in", value: view.metadata.deadlines.slice(0, rank).map(({ id }) => id) },
          {
            all: [
              { field: "deadlineId", op: "eq", value: deadlineId },
              { field: "position", op: "lt", value: fields.planPosition },
            ],
          },
        ],
      };
      const name = `step${i}`;
      computed[name] = { type: "number", cases: [{ when: before, value: 1 }], otherwise: 0 };
      metrics[name] = { operation: "sum", field: name };
    }
    const totals = await ctx.storage.records.aggregate({
      index: "timeline-placement-order",
      computed,
      where: {
        exists: {
          index: "ticket-view",
          on: [{ sourceField: "ticketId", relatedField: "id" }],
          where: activeTicket,
        },
      },
      metrics,
    });
    result.push(...page.map((_, i) => (totals.metrics?.[`step${i}`] ?? 0) + 1));
  }
  return result;
};
