import { readCollectionRecords } from "@pstdio/sdk/data";
import type { ExtensionStorageApi, StoragePredicate, StorageRecordIndex } from "@pstdio/sdk/extensions";
import type { ReviewThread } from "./attempt-types";
import { preparePlannerIndexes } from "./storage-indexes";

export const reviewThreadIndex: StorageRecordIndex = {
  name: "review-open-threads",
  collection: "planner-review-threads",
  fields: {
    id: { path: ["id"], type: "string" },
    workspaceId: { path: ["workspaceId"], type: "string" },
    state: { path: ["state"], type: "string" },
    side: { path: ["side"], type: "string" },
    path: { path: ["path"], type: "string" },
    startLine: { path: ["startLine"], type: "number" },
    endLine: { path: ["endLine"], type: "number" },
    originalHeadSha: { path: ["originalHeadSha"], type: "string" },
  },
  equality: ["workspaceId"],
  orderBy: [{ field: "id", direction: "asc" }],
};

export async function* openInlineThreadPages(storage: ExtensionStorageApi, workspaceId: string, nextHeadSha: string) {
  await preparePlannerIndexes(storage);
  let after: string | undefined;
  for (;;) {
    const where: StoragePredicate = {
      all: [
        { field: "workspaceId", op: "eq", value: workspaceId },
        { field: "state", op: "eq", value: "open" },
        { field: "side", op: "eq", value: "head" },
        { field: "originalHeadSha", op: "ne", value: nextHeadSha },
        ...["path", "startLine", "endLine"].map((field) => ({ field, op: "ne" as const, value: null })),
        ...(after ? [{ field: "id", op: "gt" as const, value: after }] : []),
      ],
    };
    const page = await storage.records.query({ index: reviewThreadIndex.name, where, fields: ["id"], limit: 100 });
    if (!page.records.length) return;
    yield (
      await readCollectionRecords<ReviewThread>(
        storage,
        page.records.map(({ recordId }) => recordId),
      )
    ).flatMap((thread) => (thread ? [thread] : []));
    after = String(page.records.at(-1)!.fields.id);
    if (page.records.length < 100) return;
  }
}
