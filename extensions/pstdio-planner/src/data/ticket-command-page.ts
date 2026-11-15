import type { CommandContext, StoragePredicate } from "@pstdio/sdk/extensions";
import { ensureTicketStorage } from "./read-migrated-tickets";
import { seedDefaultStatuses, seedDefaultTags } from "./seed";
import { ticketQuerySummary, ticketSummaryFields } from "./ticket-query-summary";
import { ticketScopePredicate } from "./ticket-scope";

export const ticketCommandPage = async (
  ctx: CommandContext,
  input: {
    status?: string;
    tags?: string[];
    parent?: string;
    archived?: boolean;
    draft?: boolean;
    includeDraft?: boolean;
    limit?: number;
    cursor?: string;
  },
) => {
  await ensureTicketStorage(ctx);
  await Promise.all([seedDefaultStatuses(ctx.storage), seedDefaultTags(ctx.storage)]);
  const scope = await ticketScopePredicate(ctx, input);
  const draft: StoragePredicate[] = input.includeDraft
    ? []
    : [{ field: "draft", op: input.draft ? "eq" : "ne", value: true }];
  const where: StoragePredicate = {
    all: [scope, { field: "archived", op: input.archived ? "eq" : "ne", value: true }, ...draft],
  };
  const total = await ctx.storage.records.aggregate({ index: "ticket-view", where });
  const page = await ctx.storage.records.query({
    index: "ticket-view",
    where,
    fields: ticketSummaryFields,
    orderBy: [{ field: "position", direction: "asc" }],
    limit: input.limit ?? 100,
    cursor: input.cursor,
    revision: total.revision,
  });
  return {
    tickets: page.records.flatMap(({ fields }) => {
      const ticket = ticketQuerySummary(fields);
      return ticket ? [ticket] : [];
    }),
    total: total.count,
    cursor: page.cursor,
    revision: page.revision,
  };
};
