import type { ExtensionStorageApi } from "@pstdio/sdk/extensions";
import type { AttemptRecord, AttemptTimelineEvent } from "./attempt-types";

type LegacyAttempt = Omit<AttemptRecord, "schemaVersion"> & { schemaVersion: 1; state: string };

const migrationKey = "agent-owned-progress-v2";

// One resumable storage upgrade preserves the originals before changing any record.
// The host serializes concurrent callers and records the checkpoint only after the upgrade succeeds.
export const upgradeAttemptStorage = (storage: ExtensionStorageApi) =>
  storage.scope({ type: "planner-storage-upgrade", id: migrationKey }).migrate(1, async () => {
    const records = storage.collection<LegacyAttempt | AttemptRecord>("planner-attempts");
    const backup = storage.collection<LegacyAttempt>("planner-attempts-v1-backup");
    const events = storage.collection<AttemptTimelineEvent>("planner-attempt-events");
    for (const record of await records.list()) {
      if (record.schemaVersion !== 1) continue;
      await backup.createIfAbsent(record.workspaceId, record);
      if (
        record.state === "abandoned" &&
        !(await events.list()).some(
          (event) => event.workspaceId === record.workspaceId && event.type === "attempt_abandoned",
        )
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
    }
    const mode = await storage.get<{ enabled: boolean; eligible?: unknown }>("auto-build");
    if (mode && mode.eligible === undefined)
      await storage.set("auto-build", { ...mode, enabled: false, eligible: { conjunction: "and", rules: [] } });
  });
