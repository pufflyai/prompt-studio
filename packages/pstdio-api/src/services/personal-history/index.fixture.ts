import type { PersonalIndexDelta } from "pstdio-db";
import type { StorageOwner } from "pstdio-sync";
import type { PersonalHistoryInput } from "./store";

/** Small isolated store/identity tests; SQL and encrypted transport have separate integration coverage. */
export const memoryPersonalIndexFixture = () => {
  const rows = new Map<string, PersonalIndexDelta[]>();
  const migrated = new Set<string>();
  const positions = new Map<string, string>();
  const key = (owner: StorageOwner) => JSON.stringify(owner);
  const index = {
    async apply(owner: StorageOwner, cursor: string | null, changes: PersonalIndexDelta[]) {
      let values = rows.get(key(owner)) ?? [];
      for (const delta of changes) {
        values = values.filter(
          (row) => row.deviceId !== delta.deviceId || row.kind !== delta.kind || row.id !== delta.id,
        );
        if (delta.value !== null) values.push(structuredClone(delta));
      }
      rows.set(key(owner), values);
      if (cursor !== null) positions.set(key(owner), cursor);
    },
    read: async (owner: StorageOwner, kind: string) =>
      (rows.get(key(owner)) ?? [])
        .filter((row) => row.kind === kind)
        .map((row) => row.value as Record<string, unknown>),
    device: async (owner: StorageOwner, kind: string, deviceId: string) =>
      (rows.get(key(owner)) ?? [])
        .filter((row) => row.kind === kind && row.deviceId === deviceId)
        .map((row) => row.value as Record<string, unknown>),
    get: async (owner: StorageOwner, kind: string, id: string) =>
      (rows.get(key(owner)) ?? []).find((row) => row.kind === kind && row.id === id)?.value as
        | Record<string, unknown>
        | undefined,
    cursor: async (owner: StorageOwner) => positions.get(key(owner)) ?? null,
    migrated: async (owner: StorageOwner) => migrated.has(key(owner)),
    seeded: async (owner: StorageOwner, kind: string, deviceId: string) =>
      new Set(
        (rows.get(key(owner)) ?? [])
          .filter((row) => row.kind === kind && row.deviceId === deviceId && row.seedId)
          .map((row) => row.id),
      ),
    markMigrated: async (owner: StorageOwner) => {
      migrated.add(key(owner));
    },
  } satisfies PersonalHistoryInput["index"];
  const logs = {
    writerId: async () => "device-a",
    open: () => ({ append: async () => ({}), read: async () => ({ entries: [], cursor: "empty", more: false }) }),
  } as unknown as PersonalHistoryInput["logs"];
  return { index, logs };
};
