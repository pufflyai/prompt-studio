import { afterAll, beforeAll, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type AssetStore, createRecordStorage, type GroupedState, type StorageOwner } from "pstdio-sync";
import { createRelayAdapter } from "pstdio-sync/relay";
import { fingerprint } from "pstdio-sync-contracts";
import { startRelay } from "../service";
import { sealStoredMutation } from "../storage/mutation.fixture";
import { withFixtureDatabase } from "./database.fixture";
import { createTransportFixture } from "./integration-fixture";

const fixture = createTransportFixture();
const sealMutation = (body: Parameters<typeof sealStoredMutation>[0]) =>
  sealStoredMutation(body, fixture.relayDatabaseUrl);
beforeAll(() => fixture.initialize());
afterAll(() => fixture.close());

const local = (owner: StorageOwner, environmentId: string, assets?: AssetStore) => {
  let state: GroupedState = { owner, accepted: null, journal: [] };
  let tail = Promise.resolve();
  return createRecordStorage({
    owner,
    environmentId,
    assets,
    store: {
      transaction: <T>(_owner: StorageOwner, action: (state: GroupedState) => Promise<T>) => {
        const result = tail.then(async () => {
          const draft = structuredClone(state);
          const result = await action(draft);
          state = draft;
          return result;
        });
        tail = result.then(
          () => undefined,
          () => undefined,
        );
        return result;
      },
    },
  });
};

test("two journal owners synchronize through the native HTTP adapter and retain disconnected work", async () => {
  const context = await fixture.context();
  const server = startRelay({ hostname: "127.0.0.1", port: 0 }, context);
  const grant = await context.manager.register({
    requestId: "second-environment",
    accountId: context.scope.accountId,
    workbenchId: context.scope.workbenchId,
    environmentId: "native-second",
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
  });
  const secondAccess = await context.issue(grant.token!);
  const controller = new AbortController();
  const adapter = (token: string) =>
    createRelayAdapter({
      origin: server.url.origin,
      scope: context.scope,
      token: async () => token,
      signal: controller.signal,
    });
  const backup = await context.storage.owner(context.scope).snapshot();
  const first = local(context.scope, context.environmentId);
  const second = local(context.scope, "native-second");
  try {
    await first.records.commit({
      operationId: "online",
      edits: [{ recordId: "note", expectedRevision: (await first.records.read("note")).revision, replace: "online" }],
    });
    expect((await first.synchronize(adapter(context.token))).status).toBe("synchronized");
    await second.synchronize(adapter(secondAccess.token));
    expect((await second.records.read("note")).value).toBe("online");
    await second.records.commit({
      operationId: "offline",
      edits: [{ recordId: "note", expectedRevision: (await second.records.read("note")).revision, replace: "offline" }],
    });
    expect((await first.records.read("note")).value).toBe("online");
    expect((await second.readState()).pending).toHaveLength(1);
    await second.synchronize(adapter(secondAccess.token));
    await first.synchronize(adapter(context.token));
    expect((await first.records.read("note")).value).toBe("offline");
    expect((await second.readState()).pending).toHaveLength(0);
    for (const [storage, operationId] of [
      [first, "first-choice"],
      [second, "second-choice"],
    ] as const)
      await storage.records.commit({
        operationId,
        edits: [
          { recordId: "note", expectedRevision: (await storage.records.read("note")).revision, replace: operationId },
        ],
      });
    await first.synchronize(adapter(context.token));
    await second.synchronize(adapter(secondAccess.token));
    const conflict = (await second.records.conflicts())[0]!;
    expect(conflict.alternativeOperationIds).toContain("second-choice");
    const inspection = await second.records.inspect(conflict.conflictId);
    await second.records.resolve({
      operationId: "resolved-choice",
      conflictId: inspection.conflictId,
      capturedOperationIds: inspection.capturedOperationIds,
      expectedConflicts: inspection.expectedConflicts,
      expectedInputs: inspection.expectedInputs,
      choose: "local",
    });
    await second.synchronize(adapter(secondAccess.token));
    await first.synchronize(adapter(context.token));
    expect(await first.records.conflicts()).toEqual([]);
    expect((await first.records.read("note")).value).toBe("second-choice");
    expect((await second.records.read("note")).value).toBe("second-choice");
    const observerGrant = await context.manager.register({
      requestId: "observer-environment",
      accountId: context.scope.accountId,
      workbenchId: context.scope.workbenchId,
      environmentId: "native-observer",
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    });
    const observerAccess = await context.issue(observerGrant.token!);
    const observer = local(context.scope, "native-observer");
    await observer.synchronize(adapter(observerAccess.token));
    const beforeRestore = await context.storage.owner(context.scope).snapshot();
    expect(beforeRestore.receipts["second-choice"].status).toBe("conflict");
    expect(beforeRestore.receipts["resolved-choice"].status).toBe("accepted");
    await context.storage.owner(context.scope).restore(backup);
    await expect(observer.synchronize(adapter(observerAccess.token))).rejects.toThrow("Resynchronization required");
    expect((await observer.records.read("note")).value).toBe("second-choice");
    const retained = await observer.readState();
    expect(retained.journal.map((entry) => entry.mutation.operationId)).toContain("resolved-choice");
    expect((await context.storage.owner(context.scope).snapshot()).records).toEqual(backup.records);
  } finally {
    controller.abort();
    await server.stop(true);
    await context.close();
  }
});

test("an unfinished foreign asset does not stop unrelated downloads or queued local saves", async () => {
  const context = await fixture.context();
  const server = startRelay({ hostname: "127.0.0.1", port: 0 }, context);
  const directory = await mkdtemp(join(tmpdir(), "native-pending-asset-"));
  const controller = new AbortController();
  const assets: AssetStore = {
    async verifyComplete(references) {
      for (const asset of references) {
        const file = Bun.file(join(directory, asset.sha256));
        const bytes = await file.bytes();
        if (
          bytes.length !== asset.byteLength ||
          new Bun.CryptoHasher("sha256").update(bytes).digest("hex") !== asset.sha256
        )
          throw new Error("Asset integrity mismatch");
      }
    },
    async read(asset) {
      return Bun.file(join(directory, asset.sha256)).stream();
    },
    async receive(asset, source) {
      await Bun.write(join(directory, asset.sha256), await source(0, controller.signal));
      await assets.verifyComplete([asset]);
    },
  };
  const adapter = (token: string) =>
    createRelayAdapter({
      origin: server.url.origin,
      scope: context.scope,
      token: async () => token,
      signal: controller.signal,
    });
  try {
    const pending = await sealMutation({
      protocolVersion: 2,
      scope: context.scope,
      environmentId: context.environmentId,
      operationId: "unfinished-upload",
      parents: ["toString"],
      changes: [
        {
          recordId: "image",
          expectedRevision: 0,
          baseDeleted: false,
          asset: { base: null, next: { sha256: "a".repeat(64), byteLength: 1, mediaType: "image/png" } },
        },
      ],
    });
    expect((await adapter(context.token).submit(pending)).status).toBe("pending");
    const note = await sealMutation({
      protocolVersion: 2,
      scope: context.scope,
      environmentId: context.environmentId,
      operationId: "unrelated-note",
      parents: [],
      changes: [
        {
          recordId: "note",
          expectedRevision: 0,
          baseDeleted: false,
          value: { expected: await fingerprint(null), next: "available" },
        },
      ],
    });
    expect((await adapter(context.token).submit(note)).status).toBe("accepted");
    const grant = await context.manager.register({
      requestId: "asset-observer",
      accountId: context.scope.accountId,
      workbenchId: context.scope.workbenchId,
      environmentId: "asset-observer",
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    });
    const access = await context.issue(grant.token!);
    const observer = local(context.scope, "asset-observer", assets);
    await observer.records.commit({
      operationId: "queued-local",
      edits: [
        {
          recordId: "local",
          expectedRevision: (await observer.records.read("local")).revision,
          replace: "queued",
        },
      ],
    });
    expect((await observer.synchronize(adapter(access.token))).status).toBe("synchronized");
    expect((await observer.records.read("note")).value).toBe("available");
    const snapshot = await context.storage.owner(context.scope).snapshot();
    expect(snapshot.receipts["unfinished-upload"].status).toBe("pending");
    expect(snapshot.records.local.value).toBe("queued");
  } finally {
    controller.abort();
    await server.stop(true);
    await context.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test("a concurrent publication declines coverage without failing completed content synchronization", async () => {
  const context = await fixture.context();
  const server = startRelay({ hostname: "127.0.0.1", port: 0 }, context);
  const controller = new AbortController();
  const adapter = createRelayAdapter({
    origin: server.url.origin,
    scope: context.scope,
    token: async () => context.token,
    signal: controller.signal,
  });
  const storage = local(context.scope, context.environmentId);
  try {
    await storage.records.commit({
      operationId: "local-save",
      edits: [
        { recordId: "note", expectedRevision: (await storage.records.read("note")).revision, replace: "accepted" },
      ],
    });
    const synchronized = await storage.synchronize({
      ...adapter,
      acknowledge: async (ack) => {
        await context.storage.owner(context.scope).publishRevision("published-notes", "concurrent-publication");
        return adapter.acknowledge(ack);
      },
    });
    expect(synchronized.status).toBe("synchronized");
    await withFixtureDatabase(fixture.relayDatabaseUrl, async (client) => {
      const result = await client.query('SELECT * FROM relay_acknowledgements WHERE "ownerId"=$1', [
        await fingerprint(context.scope),
      ]);
      expect(result.rows).toEqual([]);
    });
    expect((await storage.readState()).pending).toEqual([]);
    expect((await context.storage.owner(context.scope).snapshot()).covered).toBe(0);
  } finally {
    controller.abort();
    await server.stop(true);
    await context.close();
  }
});
