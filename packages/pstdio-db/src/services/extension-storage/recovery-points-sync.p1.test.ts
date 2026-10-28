import { afterEach, expect, test } from "bun:test";
import { createSyncSpace } from "pstdio-sync/encryption";
import { createRecordStreamSync } from "pstdio-sync/relay";
import { createDb } from "../../db/connection.pglite";
import { projects } from "../../db/schemas.pg";
import { createExtensionInstancesDBService } from "../extension-instances/extension-instances";
import { createInstalledExtensionSourcesDBService } from "../installed-extension-sources/installed-extension-sources";
import { createExtensionStorageDBService } from "./extension-storage";
import { createAssets, createRelay } from "./record-stream-relay.fixture";

const cleanup: (() => Promise<unknown>)[] = [];
afterEach(async () => {
  for (const close of cleanup.splice(0).reverse()) await close();
});

const projectId = crypto.randomUUID();
const owner = { workbenchId: projectId, extensionId: "ext.tickets" };
const space = await createSyncSpace({ projectId, spaceOwner: null, keys: [{ generation: 1, secret: "A".repeat(43) }] });
const documentId = await space.documentId(JSON.stringify([owner.extensionId, "record-stream"]));

const device = async (relay: ReturnType<typeof createRelay>["relay"]) => {
  const { db, close } = await createDb({ path: ":memory:" });
  cleanup.push(close);
  const timestamp = new Date().toISOString();
  await db
    .insert(projects)
    .values({ id: projectId, name: "Tickets", shorthand: "T", created_at: timestamp, updated_at: timestamp });
  // Recovery points cover the extensions installed in the project.
  const source = await createInstalledExtensionSourcesDBService(db).register({
    install_name: owner.extensionId,
    extension_id: owner.extensionId,
    display_name: owner.extensionId,
    source_kind: "local_path",
    source_path: `/builtin/${owner.extensionId}`,
  });
  await createExtensionInstancesDBService(db).create({
    installed_extension_id: source.id,
    scope_type: "project",
    scope_id: projectId,
  });
  const svc = createExtensionStorageDBService(db, undefined, { freeBytes: async () => Number.MAX_SAFE_INTEGER });
  const assets = createAssets();
  const sync = createRecordStreamSync({
    space,
    documentId,
    relay,
    store: svc.documents.recordStream(owner),
    assets: assets.store,
    quarantine: async () => {},
  });
  const records = (await svc.open({ owner })).records;
  return { svc, sync, records };
};

test("a ticket deleted on one device comes back on both devices after a restore", async () => {
  const { relay } = createRelay();
  const first = await device(relay);
  const second = await device(relay);
  await first.records.commit({ operationId: "create", edits: [{ recordId: "PS-1", replace: { title: "Saved" } }] });
  await first.sync.synchronize();
  await second.sync.synchronize();
  await first.svc.recovery.capture(projectId);
  const [point] = await first.svc.recovery.list(projectId);

  await second.records.commit({ operationId: "delete", edits: [{ recordId: "PS-1", deleted: true }] });
  await second.sync.synchronize();
  await first.sync.synchronize();
  expect((await first.records.read("PS-1")).deleted).toBe(true);

  await first.svc.recovery.restore(projectId, { hours: point!.hours, capturedAt: point!.capturedAt });
  await first.sync.synchronize();
  await second.sync.synchronize();
  for (const peer of [first, second]) expect((await peer.records.read("PS-1")).value).toEqual({ title: "Saved" });
});
