import type { ExtensionStorageApi, StorageRecordIndex } from "@pstdio/sdk/extensions";
import { preparePlannerIndexes } from "./storage-indexes";
import { TICKET_KEY_PREFIX } from "./ticket-record-address";

export const mergeTicketIndex: StorageRecordIndex = {
  name: "merge-check-tickets",
  keyPrefix: TICKET_KEY_PREFIX,
  fields: {
    id: { path: ["id"], type: "string" },
    statusId: { path: ["statusId"], type: "string" },
    archived: { path: ["archived"], type: "boolean" },
    hasReviewLinks: {
      path: [],
      type: "boolean",
      derive: {
        kind: "expression",
        expression: {
          each: { get: { variable: "value" }, key: "reviewLinks" },
          as: "link",
          mode: "some",
          where: {
            op: "and",
            args: [
              { op: "eq", args: [{ get: { variable: "link" }, key: "provider" }, { literal: "github" }] },
              { op: "eq", args: [{ get: { variable: "link" }, key: "kind" }, { literal: "pull_request" }] },
            ],
          },
        },
      },
    },
  },
  orderBy: [{ field: "id", direction: "asc" }],
};

/** A stable key survives status and merge-evidence writes between batches. */
export async function* mergeTicketPages(storage: ExtensionStorageApi) {
  await preparePlannerIndexes(storage);
  let after: string | undefined;
  for (;;) {
    const page = await storage.records.query({
      index: mergeTicketIndex.name,
      fields: ["id", "statusId", "hasReviewLinks"],
      limit: 100,
      where: {
        all: [
          { field: "archived", op: "ne", value: true },
          ...(after ? [{ field: "id", op: "gt" as const, value: after }] : []),
        ],
      },
    });
    if (!page.records.length) return;
    yield page.records.map(({ fields }) => ({
      id: String(fields.id),
      statusId: fields.statusId,
      hasReviewLinks: fields.hasReviewLinks === true,
    }));
    after = String(page.records.at(-1)!.fields.id);
    if (page.records.length < 100) return;
  }
}
