import { defineCommand } from "@pstdio/sdk/extensions";
import { timelineBoard } from "../../data/ticket-board";
import { timelineViewSchema } from "./view-schema";

export const planSchemaCommand = defineCommand({
  id: "timeline.plan.schema",
  title: "Read Timeline fields",
  async run(ctx) {
    const [schema, savedViews] = await Promise.all([timelineViewSchema(ctx), ctx.views.list(timelineBoard)]);
    return {
      projectId: ctx.projectId,
      ticketRows: schema.rows,
      ticketAttributes: schema.attributes,
      savedViews,
    };
  },
});
