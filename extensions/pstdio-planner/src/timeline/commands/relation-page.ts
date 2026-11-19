import { defineCommand, params, type StoragePredicate } from "@pstdio/sdk/extensions";
import { ensureTicketStorage } from "../../data/read-migrated-tickets";
import { activeTicket } from "../../data/ticket-view-state";
import { readWorkflowStatuses, usableWorkflowStatuses } from "../../data/workflow-statuses";

export const relationPageCommand = defineCommand({
  id: "timeline.relations.read",
  title: "Read ticket relationships",
  params: {
    ticketId: params.text({ required: true }),
    direction: params.text({ required: true }),
    offset: params.number(),
  },
  async run(ctx, { ticketId, direction, offset = 0 }) {
    if (!["dependsOn", "blocks"].includes(direction)) throw new Error("Choose dependencies or dependents");
    await ensureTicketStorage(ctx);
    const root = (
      await ctx.storage.records.query({
        index: "ticket-view",
        where: { field: "id", op: "eq", value: ticketId },
        fields: ["id", "dependsOn", "shorthand", "aliases"],
        limit: 1,
      })
    ).records[0];
    if (!root) throw new Error("Unknown ticket");
    const workflow = usableWorkflowStatuses(await readWorkflowStatuses(ctx));
    const refs =
      direction === "blocks"
        ? [ticketId, String(root.fields.shorthand), ...((root.fields.aliases as string[]) ?? [])]
        : ((root.fields.dependsOn as string[]) ?? []);
    const related: StoragePredicate =
      direction === "blocks"
        ? { any: refs.map((value) => ({ field: "dependsOn", op: "contains", value })) }
        : {
            any: [
              { field: "id", op: "in", value: refs },
              { field: "shorthand", op: "in", value: refs },
              {
                test: {
                  each: { field: "aliases" },
                  as: "alias",
                  mode: "some",
                  where: {
                    op: "eq",
                    args: [
                      {
                        get: { literal: Object.fromEntries(refs.map((ref) => [ref, true])) },
                        key: { variable: "alias" },
                      },
                      { literal: true },
                    ],
                  },
                },
              },
            ],
          };
    const where: StoragePredicate = {
      all: [
        activeTicket,
        related,
        ...(direction === "blocks"
          ? [{ field: "statusId", op: "notIn", value: workflow.completedStatusIds } satisfies StoragePredicate]
          : []),
      ],
    };
    const total = await ctx.storage.records.aggregate({ index: "ticket-view", where });
    const page = await ctx.storage.records.query({
      index: "ticket-view",
      where,
      fields: ["id", "shorthand", "statusId"],
      orderBy: [{ field: "position", direction: "asc" }],
      offset,
      limit: 25,
      revision: total.revision,
    });
    return {
      links: page.records.map(({ fields }) => ({
        id: String(fields.id),
        shorthand: String(fields.shorthand),
        done: workflow.completedStatusIds.includes(String(fields.statusId)),
      })),
      total: total.count,
      hasNext: Boolean(page.cursor),
      offset,
    };
  },
});
