import { readCollectionRecords } from "@pstdio/sdk/data";
import type { ExtensionStorageApi, StoragePredicate, StorageRecordIndex } from "@pstdio/sdk/extensions";
import { isAttemptRecord } from "./attempt-storage";
import type { AttemptRecord, AttemptTimelineEvent } from "./attempt-types";
import { upgradeAttemptStorage } from "./attempt-upgrade";
import { preparePlannerIndexes } from "./storage-indexes";

const attemptFields: StorageRecordIndex["fields"] = {
  workspaceId: { path: ["workspaceId"], type: "string" },
  ticketId: { path: ["ticketId"], type: "string" },
  implementationSessionId: { path: ["implementationSessionId"], type: "string" },
  schemaVersion: { path: ["schemaVersion"], type: "number" },
};
export const attemptQueryIndexes: StorageRecordIndex[] = [
  ...[
    { name: "attempt-events-history", collection: "planner-attempt-events", scope: "workspaceId", direction: "asc" },
    { name: "attempt-comments-history", collection: "planner-review-comments", scope: "threadId", direction: "asc" },
    { name: "attempt-recovery-commits", collection: "planner-attempt-events", scope: "workspaceId", direction: "desc" },
  ].map(({ name, collection, scope, direction }) => ({
    name,
    collection,
    fields: {
      [scope]: { path: [scope], type: "string" as const },
      id: { path: ["id"], type: "string" as const },
      createdAt: { path: ["createdAt"], type: "string" as const },
      ...(name === "attempt-recovery-commits" ? { commitSha: { path: ["commitSha"], type: "string" as const } } : {}),
    },
    equality: [scope],
    orderBy: [
      { field: "createdAt", direction: direction as "asc" | "desc" },
      { field: "id", direction: direction as "asc" | "desc" },
    ],
  })),
  { name: "attempt-ticket", collection: "planner-attempts", fields: attemptFields, equality: ["ticketId"] },
  {
    name: "attempt-session",
    collection: "planner-attempts",
    fields: attemptFields,
    equality: ["implementationSessionId"],
  },
  { name: "attempt-schema", collection: "planner-attempts", fields: attemptFields, equality: ["schemaVersion"] },
  {
    name: "attempt-events-workspace",
    collection: "planner-attempt-events",
    fields: {
      workspaceId: { path: ["workspaceId"], type: "string" },
      id: { path: ["id"], type: "string" },
      evidenceKey: { path: ["metadata", "evidenceKey"], type: "string" },
      type: { path: ["type"], type: "string" },
    },
    equality: ["workspaceId", "type"],
  },
];

export async function* attemptQueryPages<T>(storage: ExtensionStorageApi, index: string, where?: StoragePredicate) {
  await preparePlannerIndexes(storage);
  let cursor: string | undefined;
  do {
    const page = await storage.records.query({ index, where, fields: [], limit: 100, cursor });
    yield (
      await readCollectionRecords<T>(
        storage,
        page.records.map(({ recordId }) => recordId),
      )
    ).filter((row) => row !== undefined);
    cursor = page.cursor ?? undefined;
  } while (cursor);
}

export const readTicketAttempts = async (storage: ExtensionStorageApi, ticketIds: string[]) => {
  await upgradeAttemptStorage(storage);
  const records: AttemptRecord[] = [];
  for (let offset = 0; offset < ticketIds.length; offset += 100)
    for await (const page of attemptQueryPages<AttemptRecord>(storage, "attempt-ticket", {
      field: "ticketId",
      op: "in",
      value: ticketIds.slice(offset, offset + 100),
    }))
      for (const row of page) {
        if (!isAttemptRecord(row)) throw new Error("Invalid Planner attempt record");
        records.push(row);
      }
  return records;
};

export const readWorkspaceEvents = async (storage: ExtensionStorageApi, workspaceIds: string[], type?: string) => {
  const records: AttemptTimelineEvent[] = [];
  for (let offset = 0; offset < workspaceIds.length; offset += 100) {
    const workspace: StoragePredicate = {
      field: "workspaceId",
      op: "in",
      value: workspaceIds.slice(offset, offset + 100),
    };
    const where: StoragePredicate = type ? { all: [workspace, { field: "type", op: "eq", value: type }] } : workspace;
    for await (const page of attemptQueryPages<AttemptTimelineEvent>(storage, "attempt-events-workspace", where))
      records.push(...page);
  }
  return records;
};
