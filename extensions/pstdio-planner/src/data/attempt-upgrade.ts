import type { ExtensionStorageApi } from "@pstdio/sdk/extensions";
import type { AttemptRecord, AttemptTimelineEvent } from "./attempt-types";
import { withWriteGuard } from "./write-guard";

type LegacyAttempt = Omit<AttemptRecord, "schemaVersion"> & { schemaVersion: 1; state: string };
export class PlannerStorageUpgradeBusy extends Error {
  constructor() {
    super(
      "Planner storage upgrade owns a write claim. Retry when it finishes. If the writer stopped, inspect write-claim read and follow README recovery instructions.",
    );
  }
}

const migrationKey = "agent-owned-progress-v2";

// One resumable storage upgrade preserves the originals before changing any record.
const runUpgrade = async (storage: ExtensionStorageApi) => {
  const migrations = storage.collection<{ complete: boolean }>("planner-storage-migrations");
  if ((await migrations.get(migrationKey))?.complete) return;
  const complete = await withWriteGuard(
    { storage },
    "planner-storage-upgrade",
    async () => {
      if ((await migrations.get(migrationKey))?.complete) return true;
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
      await migrations.put(migrationKey, { complete: true });
      return true;
    },
    () => false,
  );
  if (complete) return;
  throw new PlannerStorageUpgradeBusy();
};

const upgrades = new WeakMap<ExtensionStorageApi, Promise<void>>();
export const upgradeAttemptStorage = (storage: ExtensionStorageApi) => {
  const current = upgrades.get(storage);
  if (current) return current;
  const upgrading = runUpgrade(storage).finally(() => upgrades.delete(storage));
  upgrades.set(storage, upgrading);
  return upgrading;
};
