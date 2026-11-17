import type { PersonalIndexDelta } from "pstdio-db";
import type { StorageOwner } from "pstdio-sync";
import { createMemoryLogStore, type LogDirectoryEntry } from "pstdio-sync/logs";
import type { Json, StorageLogDefinition } from "pstdio-sync-contracts";
import { memoryHistoryQueries } from "./query-index.fixture";
import type { PersonalHistoryInput } from "./store";

/** Small isolated store/identity tests; SQL and encrypted transport have separate integration coverage. */
export const memoryPersonalIndexFixture = () => {
  const rows = new Map<string, PersonalIndexDelta[]>();
  const migrated = new Set<string>();
  const positions = new Map<string, string>();
  const revisions = new Map<string, object>();
  const key = (owner: StorageOwner) => JSON.stringify(owner);
  const index = {
    ...memoryHistoryQueries((owner) => rows.get(key(owner)) ?? []),
    sourcePosition: async () => 0,
    sourcePage: async () => [],
    pendingPage: async () => [],
    accept: async () => {
      throw new Error("The isolated identity fixture does not run relay transport");
    },
    async apply(owner: StorageOwner, cursor: string | null, changes: PersonalIndexDelta[]) {
      let values = rows.get(key(owner)) ?? [];
      for (const delta of changes) {
        const previous = values.find(
          (row) => row.deviceId === delta.deviceId && row.kind === delta.kind && row.id === delta.id,
        );
        if (
          delta.kind !== "heads" &&
          delta.kind !== "publications" &&
          JSON.stringify(previous?.value ?? null) !== JSON.stringify(delta.value)
        )
          revisions.set(key(owner), {});
        values = values.filter(
          (row) => row.deviceId !== delta.deviceId || row.kind !== delta.kind || row.id !== delta.id,
        );
        if (delta.value !== null) values.push(structuredClone(delta));
      }
      rows.set(key(owner), values);
      if (cursor !== null) positions.set(key(owner), cursor);
    },
    async applyPending(
      owner: StorageOwner,
      _sourceId: string,
      changes: { delta: PersonalIndexDelta; pendingId: string }[],
    ) {
      await this.apply(
        owner,
        null,
        changes.map(({ delta }) => delta),
      );
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
    isSeeded: async (owner: StorageOwner, kind: string, deviceId: string, id: string) =>
      Boolean(
        (rows.get(key(owner)) ?? []).find((row) => row.kind === kind && row.id === id && row.deviceId === deviceId)
          ?.seedId,
      ),
    visibleRevision: async (owner: StorageOwner) => {
      let revision = revisions.get(key(owner));
      if (!revision) {
        revision = {};
        revisions.set(key(owner), revision);
      }
      return revision;
    },
    markMigrated: async (owner: StorageOwner) => {
      migrated.add(key(owner));
    },
  } satisfies PersonalHistoryInput["index"];
  const streams = new Map<string, ReturnType<typeof createMemoryLogStore>["store"]>();
  const stream = (owner: StorageOwner, entry: LogDirectoryEntry) => {
    const address = JSON.stringify([owner, entry.name, entry.scope, entry.stream]);
    let store = streams.get(address);
    if (!store) {
      store = createMemoryLogStore({ address, writerId: "device-a", keep: entry.keep }).store;
      streams.set(address, store);
    }
    return store;
  };
  const logs = {
    appendMany: async (owner: StorageOwner, definition: StorageLogDefinition, scope: string, values: Json[]) => {
      const target = stream(owner, {
        ...definition,
        writer: definition.writer ?? "project",
        scope,
        stream: definition.writer === "device" ? "device-a" : "project",
      });
      return Promise.all(values.map((value) => target.append(value)));
    },
    stream: async (owner: StorageOwner, entry: LogDirectoryEntry) => {
      const target = stream(owner, entry);
      return {
        ...target,
        appendMany: (values: { id?: string; value: Json }[]) =>
          Promise.all(values.map(({ id, value }) => target.append(value, { id }))),
      };
    },
    pending: async () => false,
    writerId: async () => "device-a",
    open: () => ({ append: async () => ({}), read: async () => ({ entries: [], cursor: "empty", more: false }) }),
  } as unknown as PersonalHistoryInput["logs"];
  return { index, logs };
};
