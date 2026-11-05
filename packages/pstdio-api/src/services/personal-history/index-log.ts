import type { PersonalIndexDelta } from "pstdio-db";
import type { DocumentStore, StorageOwner } from "pstdio-sync";
import type { SyncSpace } from "pstdio-sync/encryption";
import type { DocumentRelay } from "pstdio-sync/relay";
import type { Json } from "pstdio-sync-contracts";
import { personalIndexKinds as kinds, readPersonalIndexDelta } from "./index-entry";
import { personalIndexLogName, synchronizeIndexProjection } from "./index-projection-sync";
import { indexEntrySchema } from "./index-state";
import { historyNamespace } from "./log-files";
import { legacyPersonalHistoryOwner, type PersonalHistoryInput } from "./store";

const importIndexPages = async (input: PersonalHistoryInput, latest: Map<string, PersonalIndexDelta>) => {
  if (!input.files) return;
  const namespace = historyNamespace(input);
  for (const file of await input.files.indexDevices(namespace)) {
    const origin = file.slice("index-".length);
    for await (const page of input.files.iterateIndexPages(namespace, file)) {
      for (const line of page.lines) {
        const entry = indexEntrySchema.parse(JSON.parse(line));
        const value = entry.value ? ({ ...entry.value, id: entry.id } as Json) : null;
        const delta = { deviceId: origin, kind: entry.kind, id: entry.id, value };
        latest.set(JSON.stringify([origin, entry.kind, entry.id]), delta);
      }
    }
  }
};

/** A bounded delta page and its materialized SQL cursor commit together. Legacy input is kept intact. */
export const createPersonalIndexLog = (input: PersonalHistoryInput, owner: StorageOwner, records: DocumentStore) => {
  const writeMany = async (deltas: PersonalIndexDelta[]) => {
    for (let offset = 0; offset < deltas.length; offset += 100) {
      const page = deltas.slice(offset, offset + 100);
      const entries = await input.logs.appendMany(
        owner,
        { name: "index", writer: "device" },
        "project",
        page as unknown as Json[],
      );
      await input.index.applyPending(
        owner,
        page.map((delta, index) => ({ delta, pendingId: entries[index]!.id })),
      );
    }
  };
  const write = (delta: PersonalIndexDelta) => writeMany([delta]);
  let preparing: Promise<void> | undefined;
  const migrate = async () => {
    if (await input.index.migrated(owner)) return;
    const deviceId = await input.logs.writerId();
    const legacy = await records.transaction(legacyPersonalHistoryOwner(input), async ({ document }) => ({
      records: kinds.flatMap((kind) =>
        [...document.getMap<string>(kind).entries()].map(([id, value]) => ({
          kind,
          id,
          value: JSON.parse(value) as Json,
        })),
      ),
      heads: [...document.getMap<number>("heads").entries()],
      publications: [...document.getMap<string>("publications").entries()],
    }));
    const devices = new Map(
      legacy.records
        .filter((row) => row.kind === "sessions")
        .map((row) => [row.id, (row.value as unknown as { device: { id: string } }).device.id]),
    );
    const deltas: PersonalIndexDelta[] = legacy.records.map((row) => ({
      ...row,
      deviceId: (row.value as unknown as { device: { id: string } }).device.id,
    }));
    deltas.push(
      ...legacy.heads.map(([id, sequence]) => ({
        deviceId: devices.get(id) ?? deviceId,
        kind: "heads",
        id,
        value: { id, sequence },
      })),
    );
    deltas.push(
      ...legacy.publications.map(([id, value]) => ({
        deviceId: devices.get(id) ?? deviceId,
        kind: "publications",
        id,
        value: { id, ...JSON.parse(value) },
      })),
    );
    const latest = new Map(deltas.map((delta) => [JSON.stringify([delta.deviceId, delta.kind, delta.id]), delta]));
    await importIndexPages(input, latest);
    await writeMany([...latest.values()].map((delta) => ({ ...delta, seedId: deviceId })));
    await input.index.markMigrated(owner);
  };
  const recoverPending = async () => {
    const writer = await input.logs.writerId();
    let after = 0;
    while (true) {
      const page = await input.index.pendingPage(owner, writer, after);
      if (!page.length) return;
      await input.index.applyPending(
        owner,
        page.map(({ entry }) => ({
          delta: readPersonalIndexDelta(entry.value, writer, input.accountId),
          pendingId: entry.id,
        })),
      );
      after = page.at(-1)!.sequence;
    }
  };
  const ready = () =>
    (preparing ??= migrate()
      .then(recoverPending)
      .catch((error) => {
        preparing = undefined;
        throw error;
      }));
  const syncing = new Map<string, Promise<unknown>>();
  const synchronizeIndex = (writerId: string, own: boolean, space: SyncSpace, relay: (id: string) => DocumentRelay) => {
    const run = async () => {
      await ready();
      const documentId = await space.documentId(personalIndexLogName(writerId));
      const target = relay(documentId);
      const store = await input.logs.stream(owner, {
        name: "index",
        writer: "device",
        scope: "project",
        stream: writerId,
      });
      await synchronizeIndexProjection(
        {
          owner,
          sourceId: writerId,
          accountId: input.accountId,
          index: input.index,
          store,
          space,
          documentId,
          relay: target,
          manifestBlobs: async () => {
            if (!target.manifestBlobs) throw new Error("Private index manifest transport unavailable");
            return input.logs.manifests(owner, space, await target.manifestBlobs());
          },
        },
        own,
      );
    };
    const work = (syncing.get(writerId) ?? Promise.resolve()).catch(() => {}).then(run);
    syncing.set(writerId, work);
    void work
      .finally(() => {
        if (syncing.get(writerId) === work) syncing.delete(writerId);
      })
      .catch(() => {});
    return work;
  };
  return { ready, write, writeMany, synchronizeIndex };
};
