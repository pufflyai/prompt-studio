import { defineCommand, params, type StoragePredicate } from "@pstdio/sdk/extensions";
import { ensureTicketStorage } from "../../data/read-migrated-tickets";
import { pendingReviewRequest } from "../../data/review-query-indexes";
import { readReviewRequestPage } from "../../data/review-request-storage";

export interface TimelineRequestScope {
  ticketId?: string;
  deadlineId?: string | null;
  pendingOnly?: boolean;
  offset?: number;
}
export const requestPageCommand = defineCommand({
  id: "timeline.requests.read",
  title: "Read Timeline requests",
  params: { scope: params.json<TimelineRequestScope>() },
  async run(ctx, { scope }) {
    await ensureTicketStorage(ctx);
    if (!scope) throw new Error("Select a ticket or milestone");
    if (!scope.ticketId && !Object.hasOwn(scope, "deadlineId")) throw new Error("Select a ticket or milestone");
    const selected: StoragePredicate = scope.ticketId
      ? { field: "ticketId", op: "eq", value: scope.ticketId }
      : {
          exists: {
            index: "ticket-view",
            on: [{ sourceField: "ticketId", relatedField: "id" }],
            where: {
              all: [
                { field: "archived", op: "ne", value: true },
                { field: "deadlineId", op: "eq", value: scope.deadlineId ?? null },
              ],
            },
          },
        };
    const result = await readReviewRequestPage(
      ctx.storage,
      scope.pendingOnly ? { all: [selected, pendingReviewRequest] } : selected,
      scope.offset,
    );
    const ids = [...new Set(result.requests.map(({ ticketId }) => ticketId))];
    const labels = ids.length
      ? await ctx.storage.records.query({
          index: "ticket-view",
          where: { field: "id", op: "in", value: ids },
          fields: ["id", "shorthand", "title"],
          limit: 25,
        })
      : undefined;
    const byId = new Map(labels?.records.map(({ fields }) => [fields.id, `${fields.shorthand} · ${fields.title}`]));
    return {
      ...result,
      requests: result.requests.map((request) => ({ ...request, ticketLabel: byId.get(request.ticketId) })),
    };
  },
});
