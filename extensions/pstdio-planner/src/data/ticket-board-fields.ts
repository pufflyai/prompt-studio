import { readPlanMetadata } from "../timeline/commands/placement-store";
import { byDate } from "../timeline/model/resolve-plan";
import { timelineTicketAttributes } from "../timeline/model/ticket-properties";
import { buildTicketAttributes } from "./mappers";
import { migratePlannerStorage } from "./migrate-storage";
import { seedDefaultStatuses, seedDefaultTags } from "./seed";
import { preparePlannerIndexes } from "./storage-indexes";
import type { TicketQueryContext } from "./ticket-view-selection";

export const readTicketBoardFields = async (ctx: TicketQueryContext) => {
  await migratePlannerStorage(ctx);
  const [tags, statuses, plan] = await Promise.all([
    seedDefaultTags(ctx.storage),
    seedDefaultStatuses(ctx.storage),
    readPlanMetadata(ctx.storage),
  ]);
  await preparePlannerIndexes(ctx.storage);
  const { revision } = await ctx.storage.records.query({ index: "ticket-view", fields: [], limit: 0, orderBy: [] });
  return {
    rows: [],
    // Fields-only queries select no records; keep the paged envelope at the real index revision.
    page: { offset: 0, total: 0, filteredTotal: 0, groups: [], cursor: null, revision },
    attributes: [
      ...buildTicketAttributes(statuses, tags),
      ...timelineTicketAttributes([...plan.deadlines].sort(byDate)),
    ],
  };
};
