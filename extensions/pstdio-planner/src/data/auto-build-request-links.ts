import type { ExtensionStorageApi, StorageRecordIndex } from "@pstdio/sdk/extensions";
import { preparePlannerIndexes } from "./storage-indexes";

export const reviewRequestLinkIndexes: StorageRecordIndex[] = [
  "id",
  "workspaceId",
  "attemptId",
  "sessionId",
  "relatedSessionId",
].map((field) => ({
  name: `review-request-link:${field}`,
  collection: "planner-review-requests",
  fields: {
    id: { path: ["id"], type: "string" },
    requestedAt: { path: ["requestedAt"], type: "string" },
    workspaceId: { path: ["context", "workspaceId"], type: "string" },
    attemptId: { path: ["context", "attemptId"], type: "string" },
    sessionId: { path: ["context", "sessionId"], type: "string" },
    relatedSessionId: { path: ["context", "relatedSessionId"], type: "string" },
  },
  equality: [field],
  orderBy: [{ field: "id", direction: "asc" }],
}));

/** Conversation reachability needs IDs, never request or history bodies. */
export async function* linkedAutoBuildRequestPages(
  storage: ExtensionStorageApi,
  ownership: { sessionIds: ReadonlySet<string>; attemptIds: ReadonlySet<string> },
) {
  await preparePlannerIndexes(storage);
  const seen = new Set<string>();
  const visitedSessions = new Set<string>();
  const frontier = new Set(ownership.sessionIds);
  const pages = async function* (field: string, values: string[]) {
    const legacy =
      field === "workspaceId"
        ? [
            {
              any: [
                { field: "attemptId", op: "missing" as const },
                { field: "attemptId", op: "eq" as const, value: null },
              ],
            },
          ]
        : [];
    for (let offset = 0; offset < values.length; offset += 100) {
      let after: string | undefined;
      do {
        const page = await storage.records.query({
          index: `review-request-link:${field}`,
          where: {
            all: [
              { field, op: "in", value: values.slice(offset, offset + 100) },
              { field: "id", op: "notEmpty" },
              ...legacy,
              ...(after ? [{ field: "id", op: "gt" as const, value: after }] : []),
            ],
          },
          fields: ["id", "sessionId"],
          limit: 100,
        });
        const selected = page.records.flatMap(({ fields }) => {
          if (typeof fields.id !== "string" || seen.has(fields.id)) return [];
          seen.add(fields.id);
          if (typeof fields.sessionId === "string" && !visitedSessions.has(fields.sessionId))
            frontier.add(fields.sessionId);
          return [{ id: fields.id, sessionId: typeof fields.sessionId === "string" ? fields.sessionId : undefined }];
        });
        if (selected.length) yield selected;
        if (page.records.length < 100) break;
        after = String(page.records.at(-1)!.fields.id);
      } while (after);
    }
  };
  yield* pages("attemptId", [...ownership.attemptIds]);
  yield* pages("workspaceId", [...ownership.attemptIds]);
  while (frontier.size) {
    const batch = [...frontier].slice(0, 100);
    for (const id of batch) {
      frontier.delete(id);
      visitedSessions.add(id);
    }
    yield* pages("sessionId", batch);
    yield* pages("relatedSessionId", batch);
  }
}
