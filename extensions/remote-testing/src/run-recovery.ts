import type { ExtensionStorageApi, StorageRecordIndex } from "@pstdio/sdk/extensions";
import type { RunRecord } from "./runs";

export const runRecoveryIndex = {
  name: "run-recovery",
  fields: {
    runId: { path: ["runId"], type: "string" },
    requestId: { path: ["requestId"], type: "string" },
    status: { path: ["summary", "status"], type: "string" },
  },
  orderBy: [{ field: "runId", direction: "asc" }],
} satisfies StorageRecordIndex;

export async function* unfinishedRuns(store: ExtensionStorageApi) {
  let after: string | undefined;
  while (true) {
    const page = await store.records.query({
      index: runRecoveryIndex.name,
      fields: ["runId"],
      limit: 100,
      where: {
        all: [
          { field: "runId", op: "exists" },
          { field: "requestId", op: "exists" },
          { field: "status", op: "missing" },
          ...(after ? [{ field: "runId", op: "gt" as const, value: after }] : []),
        ],
      },
    });
    const addresses = page.records.flatMap(({ recordId, fields }) =>
      typeof fields.runId === "string" && recordId === store.records.id(`run:${fields.runId}`) ? [recordId] : [],
    );
    for (const row of await store.records.readMany(addresses)) {
      const record = row.value as unknown as RunRecord;
      if (row.exists && !row.deleted && record && !record.summary) yield record;
    }
    // Run IDs are immutable UUIDs. Seek pagination permits collector admissions
    // and completed summaries to change the owner revision between pages.
    const last = page.records.at(-1)?.fields.runId;
    if (page.records.length < 100 || typeof last !== "string") return;
    after = last;
  }
}
