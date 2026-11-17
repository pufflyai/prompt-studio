import { afterEach } from "bun:test";
import { createSyncSpace } from "pstdio-sync/encryption";
import { createDocumentSync, createRecordStreamSync } from "pstdio-sync/relay";
import { createDb } from "../../db/connection.pglite";
import { projects } from "../../db/schemas.pg";
import { createDocumentStorageDBService } from "./document-storage";
import { createProjectionStatistics } from "./projection-statistics";
import { createAssets, createRelay } from "./record-stream-relay.fixture";
import { createRecordStreamStore } from "./record-stream-store";
import { createResourceRecords } from "./resource-records";

const cleanup: (() => Promise<unknown>)[] = [];
afterEach(async () => {
  for (const close of cleanup.splice(0).reverse()) await close();
});
export const peers = async () => {
  const projectId = crypto.randomUUID();
  const owner = { workbenchId: projectId, extensionId: "example.upgrade" };
  const space = await createSyncSpace({
    projectId,
    spaceOwner: null,
    keys: [{ generation: 1, secret: "A".repeat(43) }],
  });
  const legacyRelay = createRelay().relay;
  const relay = createRelay().relay;
  const nativeRelays = new Map<string, ReturnType<typeof createRelay>>();
  const oldId = await space.documentId("legacy");
  const documentId = await space.documentId("ordered");
  const devices = [];
  for (let index = 0; index < 2; index++) {
    const connection = await createDb({ path: ":memory:" });
    cleanup.push(connection.close);
    const now = new Date().toISOString();
    await connection.db
      .insert(projects)
      .values({ id: projectId, name: "Upgrade", shorthand: "U", created_at: now, updated_at: now });
    const service = createDocumentStorageDBService(connection.db);
    cleanup.push(() => service.flushStatistics());
    const assets = createAssets();
    const statistics = createProjectionStatistics(connection.db);
    cleanup.push(() => statistics.flush());
    const legacy = createResourceRecords(connection.db, owner, { statistics, changed: () => {}, assets: assets.store });
    const quarantine = async (failure: unknown) => {
      throw new Error(`Unexpected quarantine ${JSON.stringify(failure)}`);
    };
    const oldSync = createRecordStreamSync({
      space,
      documentId: oldId,
      relay: legacyRelay,
      store: createRecordStreamStore(connection.db, owner, {
        statistics,
        changed: () => {},
        metadata: service.transaction,
      }),
      quarantine,
      assets: assets.store,
    });
    const upgrade = () => ({
      records: service.open({ owner, assets: assets.store }).records,
      sync: createRecordStreamSync({
        space,
        documentId,
        relay,
        store: service.documents.recordStream(owner),
        quarantine,
        assets: assets.store,
      }),
    });
    const native = (key: string) => service.openNativeTextDocument({ owner, fileId: key });
    const oldNativeSync = async (key: string) => {
      const remote = nativeRelays.get(key) ?? createRelay();
      nativeRelays.set(key, remote);
      return createDocumentSync({
        owner,
        space,
        documentId: await space.documentId(`legacy-native:${key}`),
        relay: remote.relay,
        store: native(key).store,
        quarantine,
      });
    };
    devices.push({
      ...connection,
      owner,
      legacy,
      oldSync,
      upgrade,
      assets,
      native,
      oldNativeSync,
    });
  }
  return { first: devices[0]!, second: devices[1]! };
};
