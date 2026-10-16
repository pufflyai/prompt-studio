import { afterAll, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createAssetBytesStorage } from "pstdio-storage";
import type { RelayAdapter } from "pstdio-sync";
import type { Scope } from "pstdio-sync-contracts";
import { createConformanceServices } from "pstdio-sync-contracts/conformance";
import { createDb } from "../../db/connection.pglite";
import { projects } from "../../db/schemas.pg";
import { createGroupedStorageDBService } from "./grouped-storage";

const services = await createConformanceServices(
  process.env.SYNC_TEST_DATABASE_URL!,
  process.env.SYNC_TEST_OBJECT_ENDPOINT!,
);
const root = await mkdtemp(join(tmpdir(), "grouped-adapter-"));
const stores = await Promise.all(
  ["a", "b"].map(async (environmentId) => ({
    environmentId,
    bytes: createAssetBytesStorage(join(root, "assets", environmentId)),
    connection: await createDb({ path: join(root, environmentId) }),
  })),
);
afterAll(async () => {
  await Promise.all(stores.map((store) => store.connection.close()));
  await services.close();
  await rm(root, { recursive: true, force: true });
});

const setup = async () => {
  const scope: Scope = { accountId: "test-owner", workbenchId: crypto.randomUUID(), extensionId: "example.notes" };
  const owner = { workbenchId: scope.workbenchId, extensionId: scope.extensionId };
  const timestamp = new Date().toISOString();
  for (const store of stores) {
    await store.connection.db.insert(projects).values({
      id: scope.workbenchId,
      name: "Sync notes",
      shorthand: scope.workbenchId,
      created_at: timestamp,
      updated_at: timestamp,
    });
  }
  const client = (index: number) =>
    createGroupedStorageDBService(stores[index].connection.db).open({
      owner,
      environmentId: stores[index].environmentId,
      assets: {
        verifyComplete: async (references) => {
          for (const asset of references) await stores[index].bytes.verify(owner, asset);
        },
        read: (asset) => stores[index].bytes.open(owner, asset),
        receive: async (asset, source) => {
          const operationId = `receive:${asset.sha256}`;
          const offset = await stores[index].bytes.progress(owner, operationId);
          await stores[index].bytes.append(
            owner,
            operationId,
            offset,
            await source(offset, new AbortController().signal),
          );
          await stores[index].bytes.publish(owner, operationId, asset);
        },
      },
    });
  const adapter = (crash?: "before-commit" | "after-commit") => {
    const result: RelayAdapter = {
      scope,
      snapshot: () => services.relay.snapshot(scope),
      submit: (mutation: Parameters<typeof services.relay.submit>[0]) => services.relay.submit(mutation, crash),
      assets: {
        put: async (asset, source) =>
          services.objects.put(scope, asset, new Uint8Array(await new Response(await source()).arrayBuffer())),
        get: async (asset, offset) => {
          const bytes = await services.objects.get(scope, asset);
          return bytes ? new Blob([bytes.slice(offset)]).stream() : null;
        },
      },
    };
    return result;
  };
  return { scope, owner, client, adapter };
};

test("local groups gain synchronized status only after durable relay acceptance and recover a lost acknowledgment", async () => {
  const { scope, client, adapter } = await setup();
  const local = client(0);
  const input = {
    operationId: "accepted-once",
    edits: [
      { recordId: "one", expectedRevision: (await local.records.read("one")).revision, replace: "first" },
      { recordId: "two", expectedRevision: (await local.records.read("two")).revision, replace: "second" },
    ],
  };
  expect(await local.records.commit(input)).toMatchObject({ status: "saved-locally" });
  let lostAcknowledgment: unknown;
  try {
    await local.synchronize(adapter("after-commit"));
  } catch (error) {
    lostAcknowledgment = error;
  }
  expect(lostAcknowledgment).toBeInstanceOf(Error);
  expect((await services.relay.snapshot(scope)).checkpoint.sequence).toBe(1);
  await stores[0].connection.close();
  stores[0].connection = await createDb({ path: join(root, "a") });
  const reopened = client(0);
  expect((await reopened.synchronize(adapter())).status).toBe("synchronized");
  expect((await reopened.records.read("one")).value).toBe("first");
  expect((await reopened.records.read("two")).value).toBe("second");
  expect(await reopened.records.commit(input)).toMatchObject({ status: "synchronized", operationId: "accepted-once" });
  expect((await services.relay.snapshot(scope)).checkpoint.sequence).toBe(1);
  const base = await reopened.records.read("one");
  expect(
    await reopened.records.commit({
      operationId: "waiting",
      edits: [{ recordId: "one", expectedRevision: base.revision, replace: "later" }],
    }),
  ).toMatchObject({ status: "pending" });
});

test("receiving accepted changes preserves another open caller's complete local proposal", async () => {
  const { client, adapter } = await setup();
  const first = client(0);
  const second = client(1);
  await first.records.commit({
    operationId: "seed",
    edits: [{ recordId: "note", expectedRevision: (await first.records.read("note")).revision, replace: "base" }],
  });
  await first.synchronize(adapter());
  await second.synchronize(adapter());
  const firstBase = await first.records.read("note");
  const secondBase = await second.records.read("note");
  await first.records.commit({
    operationId: "first-edit",
    edits: [{ recordId: "note", expectedRevision: firstBase.revision, replace: "accepted" }],
  });
  await second.records.commit({
    operationId: "second-edit",
    edits: [
      { recordId: "note", expectedRevision: secondBase.revision, replace: "retained" },
      {
        recordId: "companion",
        expectedRevision: (await second.records.read("companion")).revision,
        replace: "complete alternative",
      },
    ],
  });
  await first.synchronize(adapter());
  expect((await second.synchronize(adapter())).status).toBe("conflict");
  expect((await second.records.read("note")).value).toBe("accepted");
  expect((await second.records.read("companion")).value).toBeNull();
  const [summary] = await second.records.conflicts();
  const conflict = await second.records.inspect(summary.conflictId);
  expect(conflict.alternatives[0].records.map((record) => record.value)).toEqual(["retained", "complete alternative"]);
});

test("verified local asset streams are published with their group and downloaded completely by another environment", async () => {
  const { owner, scope, client, adapter } = await setup();
  const bytes = new TextEncoder().encode("one immutable asset with its caption");
  const asset = {
    sha256: new Bun.CryptoHasher("sha256").update(bytes).digest("hex"),
    byteLength: bytes.byteLength,
    mediaType: "image/png",
  };
  await stores[0].bytes.append(owner, "image", 0, new Blob([bytes]).stream());
  await stores[0].bytes.publish(owner, "image", asset);
  const first = client(0);
  await first.records.commit({
    operationId: "image-and-caption",
    edits: [
      { recordId: "image", expectedRevision: (await first.records.read("image")).revision, asset },
      {
        recordId: "caption",
        expectedRevision: (await first.records.read("caption")).revision,
        replace: "Complete caption",
      },
    ],
  });
  expect((await first.synchronize(adapter())).status).toBe("synchronized");
  const second = client(1);
  expect((await second.synchronize(adapter())).status).toBe("synchronized");
  expect((await second.records.read("image")).asset).toEqual(asset);
  expect((await second.records.read("caption")).value).toBe("Complete caption");
  await stores[1].bytes.verify(owner, asset);
  expect(await services.objects.get(scope, asset)).toEqual(bytes);
});

test("a dependent edit cannot expose a foreign group's text before its complete asset is accepted", async () => {
  const { owner, client, adapter } = await setup();
  const first = client(0);
  const second = client(1);
  await first.synchronize(adapter());
  const source = new Blob(["pending image"]);
  const asset = {
    sha256: new Bun.CryptoHasher("sha256").update(await source.arrayBuffer()).digest("hex"),
    byteLength: source.size,
    mediaType: "image/png",
  };
  await stores[0].bytes.append(owner, "pending-image", 0, source.stream());
  await stores[0].bytes.publish(owner, "pending-image", asset);
  await first.records.commit({
    operationId: "parent",
    edits: [
      {
        recordId: "note",
        expectedRevision: (await first.records.read("note")).revision,
        shared: [{ kind: "text.insert", index: 0, text: "parent" }],
        asset,
      },
    ],
  });
  expect((await services.relay.submit(await first.mutation("parent"))).status).toBe("pending");
  await second.synchronize(adapter());
  const branch = await second.records.read("note", { operationId: "parent" });
  expect(
    (
      await second.records.commit({
        operationId: "child",
        edits: [
          {
            recordId: "note",
            expectedRevision: branch.revision,
            shared: [{ kind: "text.insert", index: 6, text: " child" }],
          },
          {
            recordId: "dependent",
            expectedRevision: (await second.records.read("dependent")).revision,
            replace: "with the child",
          },
        ],
      })
    ).status,
  ).toBe("pending");
  expect((await second.records.read("note")).exists).toBe(false);
  expect((await second.records.read("dependent")).exists).toBe(false);
  await first.synchronize(adapter());
  await second.synchronize(adapter());
  const complete = await second.records.read("note");
  expect(complete.asset).toEqual(asset);
  expect(complete.shared).toEqual({ kind: "text", value: "parent child" });
  expect((await second.records.read("dependent")).value).toBe("with the child");
});
