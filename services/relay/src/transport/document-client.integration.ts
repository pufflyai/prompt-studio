import { afterAll, beforeAll, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type AssetStore, createDocumentStorage, createMemoryDocumentStore, sealState, sealUpdate } from "pstdio-sync";
import {
  createDocumentRelay,
  createDocumentRelayConnection,
  createDocumentSync,
  fetchSyncSpaces,
} from "pstdio-sync/relay";
import type { StateEnvelope } from "pstdio-sync-contracts";
import { startRelay } from "../service";
import { createTransportFixture } from "./integration-fixture";

const fixture = createTransportFixture();
beforeAll(() => fixture.initialize());
afterAll(() => fixture.close());
const day = 86_400_000;
const open = async () => {
  const context = await fixture.context();
  const relay = startRelay({ hostname: "127.0.0.1", port: 0 }, context);
  const manager = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: context.managerHandler });
  const controller = new AbortController();
  const { project: space } = await fetchSyncSpaces({
    managerOrigin: manager.url.origin,
    credential: context.device.token,
    ...context.scope,
  });
  const documentId = await space.documentId("notes");
  const root = await mkdtemp(join(tmpdir(), "document-client-"));
  const clients: ReturnType<typeof createDocumentSync>[] = [];
  const device = async () => {
    const login = await context.manager.registerDevice({
      accountId: context.scope.accountId,
      deviceId: crypto.randomUUID(),
      name: "Document client",
      platform: "linux",
    });
    const access = await context.issue(login.token);
    const directory = join(root, login.deviceId);
    const assets: AssetStore = {
      async verifyComplete(references) {
        for (const asset of references) {
          const bytes = await Bun.file(join(directory, asset.sha256)).bytes();
          if (
            bytes.length !== asset.byteLength ||
            new Bun.CryptoHasher("sha256").update(bytes).digest("hex") !== asset.sha256
          )
            throw new Error("Asset integrity mismatch");
        }
      },
      read: async (asset) => Bun.file(join(directory, asset.sha256)).stream(),
      async receive(asset, source) {
        await Bun.write(join(directory, asset.sha256), await source(0, controller.signal));
        await assets.verifyComplete([asset]);
      },
    };
    const store = createMemoryDocumentStore();
    const storage = createDocumentStorage({ owner: context.scope, store, assets });
    const adapter = createDocumentRelay({
      origin: relay.url.origin,
      space,
      documentId,
      token: async () => access.token,
      signal: controller.signal,
    });
    const quarantined: string[] = [];
    const sync = createDocumentSync({
      owner: context.scope,
      store,
      space,
      documentId,
      relay: adapter,
      assets,
      limits: { updates: 1, bytes: 1_048_576 },
      quarantine: async (failure) => {
        quarantined.push(failure.id);
      },
    });
    clients.push(sync);
    return {
      storage,
      sync,
      adapter,
      quarantined,
      assets,
      save: (id: string, value: string) =>
        storage.records.commit({ operationId: crypto.randomUUID(), edits: [{ recordId: id, replace: value }] }),
      async stage(bytes: Uint8Array) {
        const asset = {
          sha256: new Bun.CryptoHasher("sha256").update(bytes).digest("hex"),
          byteLength: bytes.length,
          mediaType: "application/octet-stream",
        };
        await Bun.write(join(directory, asset.sha256), bytes);
        return asset;
      },
    };
  };
  return {
    context,
    relay,
    space,
    documentId,
    device,
    controller,
    async close() {
      controller.abort();
      for (const client of clients) client.close();
      await Promise.all([relay.stop(true), manager.stop(true)]);
      await context.close();
      await rm(root, { recursive: true, force: true });
    },
  };
};

test("offline edits catch up after several retained latest states are removed", async () => {
  const f = await open();
  try {
    const first = await f.device();
    const offline = await f.device();
    await first.save("initial", "kept");
    await first.sync.synchronize();
    await offline.sync.synchronize();
    await offline.save("offline", "offline edit");
    for (let i = 0; i < 6; i++) {
      await first.save(`online-${i}`, `value-${i}`);
      await first.sync.synchronize();
    }
    await f.context.sync.cleanup(new Date(Date.now() + 8 * day));
    await offline.sync.synchronize();
    await first.sync.synchronize();
    expect((await offline.storage.records.list()).map(({ recordId, value }) => [recordId, value])).toEqual(
      (await first.storage.records.list()).map(({ recordId, value }) => [recordId, value]),
    );
    expect((await first.storage.records.read("offline")).value).toBe("offline edit");
  } finally {
    await f.close();
  }
});

test("an incomplete latest state is repaired and malformed updates do not stop healthy edits", async () => {
  const f = await open();
  try {
    const first = await f.device();
    await first.save("kept", "still here");
    await first.sync.synchronize();
    await first.adapter.replace(
      await sealState(f.space, f.documentId, {
        baseStateId: null,
        through: 1,
        state: new Uint8Array([0, 0]),
        summary: new Uint8Array([0]),
        blobIds: [],
      }),
    );
    await f.context.sync.cleanup(new Date(Date.now() + 8 * day));
    await first.sync.synchronize();
    const invalid = await sealUpdate(f.space, f.documentId, new Uint8Array([255]), []);
    await first.adapter.update(invalid);
    await first.save("healthy", "new edit");
    await first.sync.synchronize();
    const second = await f.device();
    await second.sync.synchronize();
    expect((await second.storage.records.read("kept")).value).toBe("still here");
    expect((await second.storage.records.read("healthy")).value).toBe("new edit");
    expect(second.quarantined).toEqual([invalid.updateId]);
  } finally {
    await f.close();
  }
});

test("blobs upload before their updates and an offline reference survives the grace period", async () => {
  const f = await open();
  try {
    const first = await f.device();
    const offline = await f.device();
    const bytes = new TextEncoder().encode("drawing made offline");
    const asset = await first.stage(bytes);
    await first.storage.records.commit({ operationId: "drawing", edits: [{ recordId: "drawing", asset }] });
    await first.sync.synchronize();
    await first.save("other", "forces latest state");
    await first.sync.synchronize();
    await offline.sync.synchronize();
    await first.storage.records.commit({ operationId: "remove", edits: [{ recordId: "drawing", deleted: true }] });
    await first.sync.synchronize();
    await first.save("other", "new latest state");
    await first.sync.synchronize();
    // The offline device still holds the old reference and uses it in a new record.
    await offline.storage.records.commit({ operationId: "reuse", edits: [{ recordId: "offline-drawing", asset }] });
    await f.context.sync.cleanup(new Date(Date.now() + 6 * day));
    await offline.sync.synchronize();
    const newcomer = await f.device();
    await newcomer.sync.synchronize();
    expect((await newcomer.storage.records.read("offline-drawing")).asset).toEqual(asset);
    expect(new Uint8Array(await new Response(await newcomer.assets.read(asset)).arrayBuffer())).toEqual(bytes);
  } finally {
    await f.close();
  }
});

test("competing latest-state uploads use CAS and both devices keep their work", async () => {
  const f = await open();
  try {
    const first = await f.device();
    const second = await f.device();
    await first.save("first", "one");
    await second.save("second", "two");
    await Promise.all([first.sync.synchronize(), second.sync.synchronize()]);
    await first.sync.synchronize();
    await second.sync.synchronize();
    expect((await first.storage.records.list()).map(({ recordId, value }) => [recordId, value])).toEqual(
      (await second.storage.records.list()).map(({ recordId, value }) => [recordId, value]),
    );
    const read = await first.adapter.read(0);
    expect(read.state).not.toBeNull();
    const stale: StateEnvelope = await sealState(f.space, f.documentId, {
      baseStateId: null,
      through: read.lastSequence,
      state: new Uint8Array([0, 0]),
      summary: new Uint8Array([0]),
      blobIds: [],
    });
    expect(await first.adapter.replace(stale)).toBe(false);
  } finally {
    await f.close();
  }
});

test("the document live connection wakes on a state replacement without a new update", async () => {
  const f = await open();
  let connection: ReturnType<typeof createDocumentRelayConnection> | undefined;
  try {
    const client = await f.device();
    let passes = 0;
    const ready = Promise.withResolvers<void>();
    const changed = Promise.withResolvers<void>();
    connection = createDocumentRelayConnection({
      origin: f.relay.url.origin,
      projectId: f.context.scope.workbenchId,
      signal: f.controller.signal,
      access: async () => ({ token: f.context.token, expiresAt: new Date(Date.now() + 30_000).toISOString() }),
      synchronize: async () => {
        if (++passes === 1) ready.resolve();
        else changed.resolve();
      },
    });
    await ready.promise;
    await client.adapter.replace(
      await sealState(f.space, f.documentId, {
        baseStateId: null,
        through: 0,
        state: new Uint8Array([0, 0]),
        summary: new Uint8Array([0]),
        blobIds: [],
      }),
    );
    await changed.promise;
    expect(passes).toBeGreaterThan(1);
  } finally {
    await f.close();
    await connection?.done;
  }
});

test("large offline documents use the latest-state channel when an update frame is too small", async () => {
  const f = await open();
  try {
    const first = await f.device();
    const second = await f.device();
    const content = "large offline note".repeat(70_000);
    await first.save("large", content);
    await first.sync.synchronize();
    await second.sync.synchronize();
    expect((await second.storage.records.read("large")).value).toBe(content);
    expect((await second.adapter.read(0)).state).not.toBeNull();
  } finally {
    await f.close();
  }
});

test("a device without the old ciphertext can restage a blob after relay cleanup", async () => {
  const f = await open();
  try {
    const first = await f.device();
    const bytes = new TextEncoder().encode("reused drawing");
    const asset = await first.stage(bytes);
    await first.storage.records.commit({ operationId: "old", edits: [{ recordId: "drawing", asset }] });
    await first.sync.synchronize();
    await first.save("counter", "one");
    await first.sync.synchronize();
    await first.storage.records.commit({ operationId: "remove", edits: [{ recordId: "drawing", deleted: true }] });
    await first.sync.synchronize();
    await first.save("counter", "two");
    await first.sync.synchronize();
    await f.context.sync.cleanup(new Date(Date.now() + 8 * day));
    const newcomer = await f.device();
    await newcomer.sync.synchronize();
    await newcomer.stage(bytes);
    await newcomer.storage.records.commit({ operationId: "restage", edits: [{ recordId: "drawing-again", asset }] });
    await newcomer.sync.synchronize();
    const observer = await f.device();
    await observer.sync.synchronize();
    expect(new Uint8Array(await new Response(await observer.assets.read(asset)).arrayBuffer())).toEqual(bytes);
  } finally {
    await f.close();
  }
});

test("concurrent deletion and offline blob reuse merge without quarantining either edit", async () => {
  const f = await open();
  try {
    const first = await f.device();
    const offline = await f.device();
    const bytes = new TextEncoder().encode("shared drawing");
    const asset = await first.stage(bytes);
    await first.storage.records.commit({ operationId: "drawing", edits: [{ recordId: "drawing", asset }] });
    await first.sync.synchronize();
    await offline.sync.synchronize();
    await first.storage.records.commit({ operationId: "delete", edits: [{ recordId: "drawing", deleted: true }] });
    await offline.storage.records.commit({ operationId: "reuse", edits: [{ recordId: "copy", asset }] });
    await first.sync.synchronize();
    await offline.sync.synchronize();
    await first.sync.synchronize();
    expect(first.quarantined).toEqual([]);
    expect(offline.quarantined).toEqual([]);
    expect((await first.storage.records.read("drawing")).deleted).toBe(true);
    expect((await first.storage.records.read("copy")).asset).toEqual(asset);
  } finally {
    await f.close();
  }
});
