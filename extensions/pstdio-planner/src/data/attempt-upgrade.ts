import { readCollectionRecords } from "@pstdio/sdk/data";
import type { ExtensionStorageApi } from "@pstdio/sdk/extensions";
import type { AttemptRecord, AttemptTimelineEvent } from "./attempt-types";
import { preparePlannerIndexes } from "./storage-indexes";

type LegacyAttempt = Omit<AttemptRecord, "schemaVersion"> & { schemaVersion: 1; state: string };

const migrationKey = "agent-owned-progress-v2";

const upgradeLegacyAttempt = async (storage: ExtensionStorageApi, record: LegacyAttempt) => {
  const records = storage.collection<LegacyAttempt | AttemptRecord>("planner-attempts");
  const backup = storage.collection<LegacyAttempt>("planner-attempts-v1-backup");
  const events = storage.collection<AttemptTimelineEvent>("planner-attempt-events");
  await backup.createIfAbsent(record.workspaceId, record);
  if (
    record.state === "abandoned" &&
    !(
      await storage.records.query({
        index: "attempt-events-workspace",
        where: {
          all: [
            { field: "workspaceId", op: "eq", value: record.workspaceId },
            { field: "type", op: "eq", value: "attempt_abandoned" },
          ],
        },
        fields: [],
        limit: 1,
      })
    ).records.length
  ) {
    // Keep this established logical key so already-migrated copies merge with fresh imports.
    const id = `legacy-retirement:${record.workspaceId}`;
    await events.createIfAbsent(id, {
      id,
      workspaceId: record.workspaceId,
      revision: record.revisions.at(-1)?.revision ?? null,
      type: "attempt_abandoned",
      actor: { type: "automation", id: migrationKey, displayName: "Planner storage upgrade" },
      sessionId: record.implementationSessionId,
      reportId: null,
      reviewId: null,
      threadId: null,
      commitSha: record.revisions.at(-1)?.headSha ?? null,
      createdAt: record.updatedAt,
      metadata: { reason: "Preserved legacy retirement decision" },
    });
  }
  const { state: _state, ...preserved } = record;
  await records.put(record.workspaceId, { ...preserved, schemaVersion: 2 });
};

// One resumable storage upgrade preserves the originals before changing any record.
// The host serializes concurrent callers and records the checkpoint only after the upgrade succeeds.
export const upgradeAttemptStorage = (storage: ExtensionStorageApi) =>
  storage.scope({ type: "planner-storage-upgrade", id: migrationKey }).migrate(1, async () => {
    await preparePlannerIndexes(storage);
    for (;;) {
      const page = await storage.records.query({
        index: "attempt-schema",
        where: { field: "schemaVersion", op: "eq", value: 1 },
        fields: [],
        limit: 100,
      });
      if (!page.records.length) break;
      const legacy = await readCollectionRecords<LegacyAttempt>(
        storage,
        page.records.map(({ recordId }) => recordId),
      );
      for (const record of legacy) {
        if (!record) continue;
        await upgradeLegacyAttempt(storage, record);
      }
    }
    const mode = await storage.get<{ enabled: boolean; eligible?: unknown }>("auto-build");
    if (mode && mode.eligible === undefined)
      await storage.set("auto-build", { ...mode, enabled: false, eligible: { conjunction: "and", rules: [] } });
  });
