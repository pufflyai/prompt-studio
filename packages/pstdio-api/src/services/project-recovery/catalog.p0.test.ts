import { afterEach, test as baseTest, expect } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createMemoryDocumentStore } from "pstdio-sync";
import { createSyncSpace } from "pstdio-sync/encryption";
import { createDocumentSync, type DocumentRelay } from "pstdio-sync/relay";
import type { StateEnvelope, StateInfo, StoredUpdate, UpdateEnvelope } from "pstdio-sync-contracts";
import { captureRecoveryFolder } from "./capture";
import { createRecoveryCatalog } from "./catalog";
import { createRecoveryChunkStore } from "./chunks";
import { nativeRecoverySupported } from "./native-recovery.fixture";
import { prepareRecoveryCapture } from "./transfer";

const test = baseTest.skipIf(!nativeRecoverySupported);

const roots: string[] = [];
afterEach(async () => {
  for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true });
});

test("private catalog retains independent sources and the previous complete copy when a newer upload fails", async () => {
  const root = await mkdtemp(join(tmpdir(), "recovery-catalog-"));
  roots.push(root);
  const space = await createSyncSpace({
    projectId: "project",
    spaceOwner: "account",
    keys: [{ generation: 1, secret: "A".repeat(43) }],
  });
  const blobs = new Map<string, Uint8Array>();
  const transport = {
    put: async (id: string, bytes: Uint8Array, children: string[]) => {
      for (const child of children) if (!blobs.has(child)) throw new Error("Unacknowledged child");
      blobs.set(id, bytes.slice());
    },
    get: async (id: string, length: number) => {
      const bytes = blobs.get(id);
      if (!bytes || bytes.length !== length) throw new Error("Missing blob");
      return bytes.slice();
    },
  };
  const devices = await Promise.all(
    ["first", "second", "third"].map(async (deviceId) => {
      const folder = join(root, deviceId);
      await mkdir(folder);
      await writeFile(join(folder, ".env"), `PRIVATE_FOLDER_${deviceId}`);
      const chunks = await createRecoveryChunkStore({ root: join(root, `${deviceId}-cache`), space });
      const store = createMemoryDocumentStore();
      const catalog = createRecoveryCatalog({
        projectId: "project",
        accountId: "account",
        managerOrigin: "https://manager.test",
        deviceId,
        documents: { open: () => store },
      });
      const candidate = await prepareRecoveryCapture({
        chunks,
        source: { id: "workspace", deviceId, name: deviceId, folder },
        capture: await captureRecoveryFolder({ root: folder, chunks }),
      });
      return { folder, chunks, store, catalog, candidate };
    }),
  );
  const [first, second, third] = devices;
  await first!.catalog.publish({ chunks: first!.chunks, candidate: first!.candidate, transport });
  await second!.catalog.publish({ chunks: second!.chunks, candidate: second!.candidate, transport });
  await writeFile(join(first!.folder, ".env"), "NEW_UNACKNOWLEDGED_BYTES");
  const newer = await prepareRecoveryCapture({
    chunks: first!.chunks,
    source: { id: "workspace", deviceId: "first", name: "first", folder: first!.folder },
    capture: await captureRecoveryFolder({ root: first!.folder, chunks: first!.chunks }),
  });
  await expect(
    first!.catalog.publish({
      chunks: first!.chunks,
      candidate: newer,
      transport: {
        ...transport,
        put: async () => {
          throw new Error("Quota reached");
        },
      },
    }),
  ).rejects.toThrow("Quota reached");
  expect((await first!.catalog.list()).map((entry) => entry.root)).toEqual([first!.candidate]);
  await expect(
    second!.catalog.publish({ chunks: first!.chunks, candidate: first!.candidate, transport }),
  ).rejects.toThrow("another source device");
  let latest: (StateEnvelope & StateInfo) | null = null;
  const updates: StoredUpdate[] = [];
  const sent: UpdateEnvelope[] = [];
  const relay: DocumentRelay = {
    read: async (after) => ({
      status: "updates",
      state: latest,
      lastSequence: updates.length,
      updates: updates.filter((update) => update.sequence > after),
      more: false,
    }),
    state: async () => Buffer.from(latest!.payload, "base64"),
    update: async (update) => {
      for (const id of update.blobIds) expect(blobs.has(id)).toBe(true);
      sent.push(update);
      updates.push({
        ...update,
        sequence: updates.length + 1,
        deviceId: "fixture",
        createdAt: new Date().toISOString(),
      });
      return { sequence: updates.length, duplicate: false };
    },
    replace: async (state) => {
      latest = {
        ...state,
        byteLength: Buffer.from(state.payload, "base64").length,
        deviceId: "fixture",
        createdAt: new Date().toISOString(),
      };
      return true;
    },
  };
  const syncs = await Promise.all(
    devices.map(async (device) =>
      createDocumentSync({
        owner: device.catalog.owner,
        store: device.store,
        space,
        relay,
        documentId: await space.documentId("folder-recovery-catalog"),
        quarantine: async () => {
          throw new Error("Unexpected quarantine");
        },
        references: device.catalog.references({ chunks: device.chunks, transport }),
      }),
    ),
  );
  try {
    await syncs[0]!.synchronize();
    await syncs[1]!.synchronize();
    await rm(first!.folder, { recursive: true });
    await rm(second!.folder, { recursive: true });
    await syncs[2]!.synchronize();
    expect((await third!.catalog.list()).map((entry) => entry.deviceId).sort()).toEqual(["first", "second"]);
    expect((await third!.catalog.list()).some((entry) => entry.root.blobId === newer.blobId)).toBe(false);
    for (const update of sent) {
      expect(update.payload).not.toContain("PRIVATE_FOLDER");
      expect(JSON.stringify(update.blobIds)).not.toContain(".env");
    }
  } finally {
    for (const sync of syncs) sync.close();
  }
});
