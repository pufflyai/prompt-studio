import { readCollectionRecords } from "@pstdio/sdk/data";
import type { ExtensionStorageApi, StoragePredicate } from "@pstdio/sdk/extensions";
import { preparePlannerIndexes } from "./storage-indexes";

export const readAttemptHistoryPage = async <T extends { id: string; createdAt: string }>(
  storage: ExtensionStorageApi,
  input: { scope: "workspaceId" | "threadId"; id: string; cursor?: string; limit?: number },
) => {
  await preparePlannerIndexes(storage);
  const limit = Math.min(100, Math.max(1, Math.trunc(input.limit ?? 50)));
  const separator = input.cursor?.indexOf("|") ?? -1;
  const createdAt = separator >= 0 ? input.cursor!.slice(0, separator) : undefined;
  const id = separator >= 0 ? input.cursor!.slice(separator + 1) : undefined;
  const after: StoragePredicate[] =
    createdAt && id
      ? [
          {
            any: [
              { field: "createdAt", op: "gt", value: createdAt },
              {
                all: [
                  { field: "createdAt", op: "eq", value: createdAt },
                  { field: "id", op: "gt", value: id },
                ],
              },
            ],
          },
        ]
      : [];
  const page = await storage.records.query({
    index: input.scope === "workspaceId" ? "attempt-events-history" : "attempt-comments-history",
    where: { all: [{ field: input.scope, op: "eq", value: input.id }, ...after] },
    fields: ["createdAt", "id"],
    limit: limit + 1,
  });
  const selected = page.records.slice(0, limit);
  const items = (
    await readCollectionRecords<T>(
      storage,
      selected.map(({ recordId }) => recordId),
    )
  ).filter((row) => row !== undefined);
  const last = selected.at(-1)?.fields;
  return { items, nextCursor: page.records.length > limit && last ? `${last.createdAt}|${last.id}` : null };
};
